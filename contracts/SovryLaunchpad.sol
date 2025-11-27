// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./SovryToken.sol";

/**
 * @notice Interface for Story Protocol Royalty Workflows
 * @dev Used for claiming royalties from Story Protocol
 */
interface IRoyaltyWorkflows {
    function claimAllRevenue(
        address ancestorIpId,
        address claimer,
        address[] calldata childIpIds,
        address[] calldata royaltyPolicies,
        address[] calldata currencyTokens
    ) external returns (uint256[] memory amountsClaimed);
}

/**
 * @notice Interface for PiperX V2 Router
 * @dev Used for adding liquidity when tokens graduate and for swap-based buyback after graduation
 */
interface IPiperXRouter {
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function factory() external view returns (address);

    function WETH() external view returns (address);
}

interface IPiperXFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

/**
 * @title SovryLaunchpad
 * @author Sovry
 * @notice A token launchpad with linear bonding curve mechanics, wrapper functionality, and royalty harvesting
 * @dev Implements a linear bonding curve for price discovery, allows fractional listing of royalty tokens,
 *      harvests royalties to pump the floor price, and graduates tokens to DEX when market cap threshold is reached
 */
contract SovryLaunchpad is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Treasury address that receives trading fees
    address public treasury;

    /// @notice Total trading fee in basis points (100 = 1%)
    uint256 public constant TOTAL_FEE_BPS = 100;

    /// @notice Creator share of the trading fee, in basis points of TOTAL_FEE_BPS (50 = 50% of 1% = 0.5%)
    uint256 public constant CREATOR_FEE_BPS = 50;

    /// @notice Protocol (treasury) share of the trading fee, in basis points of TOTAL_FEE_BPS (50 = 50% of 1% = 0.5%)
    uint256 public constant PROTOCOL_FEE_BPS = 50;

    /// @notice Creator premine allocation in basis points of total locked supply (500 = 5%)
    uint256 public constant CREATOR_PREMINE_BPS = 500;

    /// @notice Minimum listing percentage (10%)
    uint256 public constant MIN_LISTING_PERCENT = 10;

    /// @notice Maximum listing percentage (100%)
    uint256 public constant MAX_LISTING_PERCENT = 100;

    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice RT decimals (Story Royalty Tokens use 6 decimals)
    uint8 public constant RT_DECIMALS = 6;

    /// @notice RT unit in smallest units
    uint256 public constant RT_UNIT = 10 ** RT_DECIMALS;

    /// @notice Wrapper token decimals (SovryToken uses 6 decimals)
    uint8 public constant WRAPPER_DECIMALS = 6;

    /// @notice One whole wrapper token in smallest units
    uint256 public constant WRAP_UNIT = 10 ** WRAPPER_DECIMALS;

    /// @notice Wrapper smallest units minted per 1 RT smallest unit (UI-level 1:1,000,000 ratio per RT)
    uint256 public constant WRAP_PER_RT = 1_000_000;

    /// @notice Safety cap for basePrice to keep bonding curve math well below uint256 overflow bounds
    /// @dev 1e30 wei is far above any realistic on-chain unit price
    uint256 public constant MAX_BASE_PRICE = 1e30;

    /// @notice Safety cap for priceIncrement to keep quadratic term bounded
    /// @dev 1e30 wei per RT unit still leaves a very large headroom before overflow
    uint256 public constant MAX_PRICE_INCREMENT = 1e30;

    /// @notice Maximum percentage of the initial curve supply that can be purchased in a single transaction (in basis points)
    uint256 public constant MAX_BUY_PER_TX_BPS = 500; // 5%

    /// @notice Default graduation threshold in wei (e.g., $69,000 worth of native token)
    uint256 public graduationThreshold;

    /// @notice Minimum time that market cap must stay above the graduation threshold before a token can graduate
    uint256 public constant GRADUATION_DELAY = 15 minutes;

    /// @notice PiperX V2 Router address for liquidity migration
    address public piperXRouter;

    /// @notice Story Protocol Royalty Workflows contract address
    address public royaltyWorkflows;

    /// @notice WIP token address (native token on Story Protocol)
    address public wipToken;

    /// @notice Burn address used for LP tokens and buyback-and-burn flows
    address public constant BURN_ADDRESS = address(0x000000000000000000000000000000000000dEaD);

    /// @notice Minimum share of token/native liquidity (in basis points) that must be added during DEX migration
    uint256 public constant DEX_LP_MIN_BPS = 9500;

    /**
     * @notice Bonding curve structure for each launched token
     * @param basePrice Starting price of the token (in wei)
     * @param priceIncrement Price increase per token unit
     * @param currentSupply Current supply of tokens in the curve
     * @param reserveBalance Total reserve balance (native token) in the curve
     * @param isActive Whether the bonding curve is active (not graduated)
     */
    struct BondingCurve {
        uint256 basePrice;
        uint256 priceIncrement;
        uint256 currentSupply;
        uint256 reserveBalance;
        bool isActive;
    }

    /**
     * @notice Launched token information
     * @param rtAddress Address of the underlying Royalty Token (RT)
     * @param wrapperAddress Address of the wrapper token (SovryToken)
     * @param creator Address that launched the token
     * @param launchTime Timestamp when the token was launched
     * @param totalLocked Total amount of RT locked in the vault (RT smallest units)
     * @param graduated Whether the token has graduated to DEX
     * @param totalRoyaltiesHarvested Total royalties harvested for this token
     * @param vaultAddress Address of the vault holding locked RT (this contract)
     * @param dexReserve Reserve amount for DEX liquidity in RT smallest units
     * @param initialCurveSupply Initial wrapper token supply assigned to the bonding curve (wrapper smallest units)
     */
    struct LaunchedToken {
        address rtAddress;
        address wrapperAddress;
        address creator;
        uint256 launchTime;
        uint256 totalLocked;
        bool graduated;
        uint256 totalRoyaltiesHarvested;
        address vaultAddress;
        uint256 dexReserve;
        uint256 initialCurveSupply;
    }

    /// @notice Mapping from wrapper token address to bonding curve data
    mapping(address => BondingCurve) public bondingCurves;

    /// @notice Mapping from wrapper token address to launched token info
    mapping(address => LaunchedToken) public launchedTokens;

    /// @notice Mapping from RT address to wrapper token address
    mapping(address => address) public rtToWrapper;

    /// @notice Mapping from wrapper token to RT address
    mapping(address => address) public wrapperToRt;

    /// @notice Mapping from user address to wrapper token to locked amount
    mapping(address => mapping(address => uint256)) public userLockedAmounts;

    /// @notice Mapping from wrapper token to graduation status
    mapping(address => bool) public isGraduated;

    /// @notice Pending WIP/native amounts earmarked for buyback when swaps are not currently possible
    mapping(address => uint256) public pendingBuybacks;

    /// @notice Optional designated harvester per wrapper token
    mapping(address => address) public tokenHarvesters;

    /// @notice Array of all launched wrapper token addresses
    address[] public allLaunchedTokens;

    /// @notice Timestamp when a given wrapper token first met the graduation threshold; used to enforce GRADUATION_DELAY
    mapping(address => uint256) public graduationTimestamp;

    /// @notice Total native reserves held by all bonding curves
    uint256 public totalCurveReserves;

    /// @notice Event emitted when a token is launched
    /// @param rt Address of the royalty token
    /// @param wrapper Address of the wrapper token
    /// @param creator Address that launched the token
    /// @param amount Amount of RT locked
    /// @param launchTime Timestamp of launch
    event TokenLaunched(
        address indexed rt,
        address indexed wrapper,
        address indexed creator,
        uint256 amount,
        uint256 launchTime
    );

    /// @notice Event emitted when tokens are purchased from the bonding curve
    /// @param buyer Address that purchased tokens
    /// @param wrapperToken Address of the wrapper token
    /// @param amount Amount of tokens purchased
    /// @param cost Total cost paid (including fees)
    event TokensPurchased(
        address indexed buyer,
        address indexed wrapperToken,
        uint256 amount,
        uint256 cost
    );

    /// @notice Event emitted when tokens are sold back to the bonding curve
    /// @param seller Address that sold tokens
    /// @param wrapperToken Address of the wrapper token
    /// @param amount Amount of tokens sold
    /// @param proceeds Total proceeds received (after fees)
    event TokensSold(
        address indexed seller,
        address indexed wrapperToken,
        uint256 amount,
        uint256 proceeds
    );

    /// @notice Event emitted when royalties are harvested
    /// @param wrapperToken Address of the wrapper token
    /// @param amount Amount of royalties harvested
    event RoyaltiesHarvested(
        address indexed wrapperToken,
        uint256 amount
    );

    /// @notice Event emitted when royalties are used to buy back and burn wrapper tokens on DEX
    /// @param wrapperToken Address of the wrapper token
    /// @param wipSpent Amount of WIP/native spent in the buyback
    /// @param wrapperBurned Amount of wrapper tokens sent to the burn address
    event BuybackAndBurn(
        address indexed wrapperToken,
        uint256 wipSpent,
        uint256 wrapperBurned
    );

    /// @notice Event emitted when a buyback attempt fails or cannot be executed safely
    /// @param wrapperToken Address of the wrapper token
    /// @param wipAmount Amount of WIP/native that remains pending for future buyback
    event BuybackFailed(address indexed wrapperToken, uint256 wipAmount);

    /// @notice Event emitted when floor price is updated after royalty injection
    /// @param wrapperToken Address of the wrapper token
    /// @param newFloor New floor price
    event FloorPriceUpdated(
        address indexed wrapperToken,
        uint256 newFloor
    );

    /// @notice Event emitted when a token graduates to DEX
    /// @param wrapperToken Address of the wrapper token
    /// @param liquidity Amount of liquidity migrated
    /// @param poolAddress Address of the created liquidity pool
    event Graduated(
        address indexed wrapperToken,
        uint256 liquidity,
        address indexed poolAddress
    );

    /// @notice Event emitted when fees are collected
    /// @param wrapperToken Address of the wrapper token
    /// @param amount Amount of fees collected
    event FeesCollected(
        address indexed wrapperToken,
        uint256 amount
    );

    /// @notice Event emitted when creator receives a share of trading fees
    /// @param wrapperToken Address of the wrapper token
    /// @param creator Address of the token creator
    /// @param amount Amount of fees sent to the creator
    event CreatorFeePaid(
        address indexed wrapperToken,
        address indexed creator,
        uint256 amount
    );

    /// @notice Event emitted when additional RT is locked
    /// @param wrapperToken Address of the wrapper token
    /// @param user Address that locked additional RT
    /// @param amount Additional amount locked
    event AdditionalRTLocked(
        address indexed wrapperToken,
        address indexed user,
        uint256 amount
    );

    /// @notice Event emitted when the global graduation threshold is updated
    /// @param newThreshold New graduation threshold value in wei
    event GraduationThresholdUpdated(uint256 newThreshold);

    /// @notice Event emitted when the PiperX router address is updated
    /// @param newRouter New PiperX router address
    event PiperXRouterUpdated(address newRouter);

    /// @notice Event emitted when the treasury address is updated
    /// @param newTreasury New treasury address
    event TreasuryUpdated(address newTreasury);

    /// @notice Event emitted when a harvester is set or updated for a wrapper token
    /// @param wrapperToken Address of the wrapper token
    /// @param harvester Address authorized to harvest for this token (can be zero address to clear)
    event HarvesterUpdated(address indexed wrapperToken, address harvester);

    /**
     * @notice Constructor initializes the launchpad
     * @param _treasury Address that will receive trading fees
     * @param _piperXRouter Address of PiperX V2 Router
     * @param _royaltyWorkflows Address of Story Protocol Royalty Workflows contract
     * @param _wipToken Address of WIP token (native token)
     * @param _graduationThreshold Market cap threshold for graduation (in wei)
     * @param _initialOwner Address that will own the contract
     */
    constructor(
        address _treasury,
        address _piperXRouter,
        address _royaltyWorkflows,
        address _wipToken,
        uint256 _graduationThreshold,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_treasury != address(0), "Invalid treasury");
        require(_piperXRouter != address(0), "Invalid router");
        require(_royaltyWorkflows != address(0), "Invalid royalty workflows");
        require(_wipToken != address(0), "Invalid WIP token");
        require(_graduationThreshold > 0, "Invalid threshold");

        treasury = _treasury;
        piperXRouter = _piperXRouter;
        royaltyWorkflows = _royaltyWorkflows;
        wipToken = _wipToken;
        graduationThreshold = _graduationThreshold;
    }

    /**
     * @notice Launches a new token by locking RT and creating a wrapper token
     * @param rtAddress Address of the Royalty Token to lock
     * @param amount Amount of RT to lock (must be 10-100% of user's balance)
     * @param name Name for the wrapper token
     * @param symbol Symbol for the wrapper token
     * @param basePrice Base price for the bonding curve (in wei)
     * @param priceIncrement Price increment per token unit (in wei)
     * @dev Validates minimum 10% listing requirement
     * @dev Locks RT in this contract (acts as vault)
     * @dev Mints wrapper tokens 1:1 with locked RT
     * @dev Initializes bonding curve
     */
    function launchToken(
        address rtAddress,
        uint256 amount,
        string calldata name,
        string calldata symbol,
        uint256 basePrice,
        uint256 priceIncrement
    ) external nonReentrant whenNotPaused {
        require(rtAddress != address(0), "Invalid RT address");
        require(amount > 0, "Amount must be greater than zero");
        require(basePrice > 0 && basePrice <= MAX_BASE_PRICE, "Invalid basePrice");
        require(priceIncrement > 0 && priceIncrement <= MAX_PRICE_INCREMENT, "Invalid priceIncrement");
        require(rtToWrapper[rtAddress] == address(0), "Token already launched");

        IERC20 rt = IERC20(rtAddress);
        uint256 userBalance = rt.balanceOf(msg.sender);

        // Validate minimum 10% listing requirement
        require(amount >= (userBalance * MIN_LISTING_PERCENT) / 100, "Minimum 10% required");
        require(amount <= userBalance, "Insufficient balance");

        // Transfer RT from user to this contract (vault)
        rt.safeTransferFrom(msg.sender, address(this), amount);

        // Deploy wrapper token with this contract as owner (for minting)
        SovryToken wrapper = new SovryToken(name, symbol, rtAddress, address(this));
        // Disable public deposit-based wrapping for launchpad-managed wrappers
        wrapper.setPublicWrapping(false);
        address wrapperAddress = address(wrapper);

        // Mint wrapper tokens with a 1:WRAP_PER_RT ratio per RT smallest unit locked
        uint256 totalWrapped = amount * WRAP_PER_RT;
        wrapper.mint(address(this), totalWrapped);

        // Creator premine in RT units (5% of total locked)
        uint256 premineRt = (amount * CREATOR_PREMINE_BPS) / BPS_DENOMINATOR;
        uint256 premineWrapped = premineRt * WRAP_PER_RT;
        if (premineWrapped > 0) {
            IERC20(wrapperAddress).safeTransfer(msg.sender, premineWrapped);
        }

        // Split remaining supply in RT units: keep 20% reserved for DEX liquidity at graduation,
        // and use the rest for the bonding curve after accounting for the premine.
        uint256 dexReserveRt = (amount * 20) / 100;
        uint256 curveSupplyRt = amount - dexReserveRt - premineRt;

        // Initialize bonding curve in wrapper units (wrapper smallest units)
        uint256 curveSupplyWrapped = curveSupplyRt * WRAP_PER_RT;
        bondingCurves[wrapperAddress] = BondingCurve({
            basePrice: basePrice,
            priceIncrement: priceIncrement,
            currentSupply: curveSupplyWrapped,
            reserveBalance: 0,
            isActive: true
        });

        // Store launched token info
        launchedTokens[wrapperAddress] = LaunchedToken({
            rtAddress: rtAddress,
            wrapperAddress: wrapperAddress,
            creator: msg.sender,
            launchTime: block.timestamp,
            totalLocked: amount,
            graduated: false,
            totalRoyaltiesHarvested: 0,
            vaultAddress: address(this),
            dexReserve: dexReserveRt,
            initialCurveSupply: curveSupplyWrapped
        });

        // Update mappings
        rtToWrapper[rtAddress] = wrapperAddress;
        wrapperToRt[wrapperAddress] = rtAddress;
        userLockedAmounts[msg.sender][wrapperAddress] = amount;
        allLaunchedTokens.push(wrapperAddress);

        emit TokenLaunched(rtAddress, wrapperAddress, msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Launches a new token using RT that has already been transferred to this contract
     * @param rtAddress Address of the Royalty Token to lock
     * @param amount Amount of RT to lock
     * @param name Name for the wrapper token
     * @param symbol Symbol for the wrapper token
     * @param basePrice Base price for the bonding curve (in wei)
     * @param priceIncrement Price increment per token unit (in wei)
     * @dev This variant is intended for tokens like Story RT that users may transfer manually
     *      via wallets (e.g., MetaMask). It does NOT call transferFrom, and instead assumes the
     *      caller has already prefunded this contract with exactly the desired amount.
     * @dev Preserves the 10% minimum listing requirement by reconstructing the user's effective
     *      balance as their current balance plus the prefunded amount held by this contract.
     * @dev Security properties (RT locked in vault, 75/20/5 split, anti-rug emergencyWithdraw)
     *      remain the same as in launchToken.
     */
    function launchTokenPrefunded(
        address rtAddress,
        uint256 amount,
        string calldata name,
        string calldata symbol,
        uint256 basePrice,
        uint256 priceIncrement
    ) external nonReentrant whenNotPaused {
        require(rtAddress != address(0), "Invalid RT address");
        require(amount > 0, "Amount must be greater than zero");
        require(basePrice > 0, "Base price must be greater than zero");
        require(priceIncrement > 0, "Price increment must be greater than zero");
        require(rtToWrapper[rtAddress] == address(0), "Token already launched");

        IERC20 rt = IERC20(rtAddress);

        // Prefunded balance for this RT held by the launchpad
        uint256 contractBalance = rt.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient prefunded balance");

        // Reconstruct user's effective balance as current wallet + prefunded amount,
        // under the assumption that the prefunding came from this caller.
        uint256 userBalanceNow = rt.balanceOf(msg.sender);
        uint256 effectiveBalance = userBalanceNow + amount;

        // Enforce the same 10% minimum listing requirement as launchToken
        require(amount >= (effectiveBalance * MIN_LISTING_PERCENT) / 100, "Minimum 10% required");

        // From here, logic mirrors launchToken: we treat 'amount' as totalLocked RT.

        SovryToken wrapper = new SovryToken(name, symbol, rtAddress, address(this));
        address wrapperAddress = address(wrapper);

        // Mint wrapper tokens with a 1:WRAP_PER_RT ratio per RT smallest unit locked
        uint256 totalWrapped = amount * WRAP_PER_RT;
        wrapper.mint(address(this), totalWrapped);

        uint256 premineRt = (amount * CREATOR_PREMINE_BPS) / BPS_DENOMINATOR;
        uint256 premineWrapped = premineRt * WRAP_PER_RT;
        if (premineWrapped > 0) {
            IERC20(wrapperAddress).safeTransfer(msg.sender, premineWrapped);
        }

        uint256 dexReserveRt = (amount * 20) / 100;
        uint256 curveSupplyRt = amount - dexReserveRt - premineRt;

        uint256 curveSupplyWrapped = curveSupplyRt * WRAP_PER_RT;
        bondingCurves[wrapperAddress] = BondingCurve({
            basePrice: basePrice,
            priceIncrement: priceIncrement,
            currentSupply: curveSupplyWrapped,
            reserveBalance: 0,
            isActive: true
        });

        launchedTokens[wrapperAddress] = LaunchedToken({
            rtAddress: rtAddress,
            wrapperAddress: wrapperAddress,
            creator: msg.sender,
            launchTime: block.timestamp,
            totalLocked: amount,
            graduated: false,
            totalRoyaltiesHarvested: 0,
            vaultAddress: address(this),
            dexReserve: dexReserveRt,
            initialCurveSupply: curveSupplyWrapped
        });

        rtToWrapper[rtAddress] = wrapperAddress;
        wrapperToRt[wrapperAddress] = rtAddress;
        userLockedAmounts[msg.sender][wrapperAddress] = amount;
        allLaunchedTokens.push(wrapperAddress);

        emit TokenLaunched(rtAddress, wrapperAddress, msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Purchases wrapper tokens from the bonding curve
     * @param wrapperToken Address of the wrapper token to purchase
     * @param amount Amount of wrapper tokens to purchase (must be a multiple of WRAP_UNIT)
     * @param maxEthCost Maximum ETH cost (slippage protection)
     * @param deadline Deadline for the transaction
     * @dev Price increases linearly with supply: price = basePrice + (supply * increment)
     * @dev Calculates total cost including fees
     * @dev Updates bonding curve state
     */
    function buy(
        address wrapperToken,
        uint256 amount,
        uint256 maxEthCost,
        uint256 deadline
    ) external payable nonReentrant whenNotPaused {
        require(wrapperToken != address(0), "Invalid wrapper token");
        require(amount > 0, "Amount must be greater than zero");
        require(msg.value > 0, "Must send native token");
        require(block.timestamp <= deadline, "Transaction expired");

        BondingCurve storage curve = bondingCurves[wrapperToken];
        LaunchedToken storage token = launchedTokens[wrapperToken];

        require(curve.isActive, "Curve not active");
        require(!token.graduated, "Token already graduated");

        // Normalize to whole-wrapper units for bonding curve math
        require(amount % WRAP_UNIT == 0, "Invalid amount step");
        require(curve.currentSupply >= amount, "Insufficient supply");

        // Enforce a per-transaction buy cap as a fraction of the initial curve supply
        if (token.initialCurveSupply > 0) {
            uint256 maxPerTx = (token.initialCurveSupply * MAX_BUY_PER_TX_BPS) / BPS_DENOMINATOR;
            require(amount <= maxPerTx, "Exceeds max buy per transaction");
        }

        // Calculate base cost (before trading fees) using linear bonding curve formula in wrapper units
        uint256 baseCost = calculateBuyPrice(wrapperToken, amount);

        // Trading fee (1% of baseCost), split between creator and protocol
        uint256 totalFee = (baseCost * TOTAL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorShare = (totalFee * CREATOR_FEE_BPS) / TOTAL_FEE_BPS;
        uint256 protocolShare = totalFee - creatorShare;

        uint256 totalCost = baseCost + totalFee;

        // Slippage protection: user sets maximum ETH/IP they are willing to pay
        require(totalCost <= maxEthCost, "Slippage: totalCost > maxEthCost");
        require(msg.value >= totalCost, "Insufficient payment");

        // Update bonding curve state in wrapper units
        curve.currentSupply -= amount;
        curve.reserveBalance += baseCost;
        totalCurveReserves += baseCost;

        // Transfer wrapper tokens to buyer
        IERC20(wrapperToken).safeTransfer(msg.sender, amount);

        // Send creator's share of the fee
        if (creatorShare > 0) {
            (bool creatorOk, ) = payable(token.creator).call{value: creatorShare}("");
            require(creatorOk, "Creator fee transfer failed");
            emit CreatorFeePaid(wrapperToken, token.creator, creatorShare);
        }

        // Send protocol (treasury) share of the fee
        if (protocolShare > 0) {
            (bool success, ) = payable(treasury).call{value: protocolShare}("");
            require(success, "Fee transfer failed");
            emit FeesCollected(wrapperToken, protocolShare);
        }

        // Refund excess payment
        if (msg.value > totalCost) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - totalCost}("");
            require(refundSuccess, "Refund failed");
        }

        emit TokensPurchased(msg.sender, wrapperToken, amount, baseCost);
    }

    /**
     * @notice Sells wrapper tokens back to the bonding curve
     * @param wrapperToken Address of the wrapper token to sell
     * @param amount Amount of wrapper tokens to sell (must be a multiple of WRAP_UNIT)
     * @param minEthProceeds Minimum ETH proceeds (slippage protection)
     * @param deadline Deadline for the transaction
     * @dev Price decreases linearly with supply
     * @dev Calculates proceeds after fees
     * @dev Updates bonding curve state
     */
    function sell(
        address wrapperToken,
        uint256 amount,
        uint256 minEthProceeds,
        uint256 deadline
    ) external nonReentrant whenNotPaused {
        require(wrapperToken != address(0), "Invalid wrapper token");
        require(amount > 0, "Amount must be greater than zero");
        require(block.timestamp <= deadline, "Transaction expired");

        BondingCurve storage curve = bondingCurves[wrapperToken];
        LaunchedToken storage token = launchedTokens[wrapperToken];

        require(curve.isActive, "Curve not active");
        require(!token.graduated, "Token already graduated");

        // Transfer wrapper tokens from seller
        IERC20(wrapperToken).safeTransferFrom(msg.sender, address(this), amount);

        // Normalize to whole-wrapper units for bonding curve math
        require(amount % WRAP_UNIT == 0, "Invalid amount step");

        // Calculate base proceeds (before trading fees) using linear bonding curve formula in wrapper units
        uint256 baseProceeds = calculateSellPrice(wrapperToken, amount);
        require(address(this).balance >= baseProceeds, "Insufficient reserves");

        // Trading fee (1% of baseProceeds), split between creator and protocol
        uint256 totalFee = (baseProceeds * TOTAL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorShare = (totalFee * CREATOR_FEE_BPS) / TOTAL_FEE_BPS;
        uint256 protocolShare = totalFee - creatorShare;

        uint256 netProceeds = baseProceeds - totalFee;

        // Slippage protection: user sets minimum ETH/IP they are willing to receive
        require(netProceeds >= minEthProceeds, "Slippage: netProceeds < minEthProceeds");

        // Update bonding curve state in wrapper units
        curve.currentSupply += amount;
        curve.reserveBalance -= baseProceeds;
        totalCurveReserves -= baseProceeds;

        // Send proceeds to seller
        (bool success, ) = payable(msg.sender).call{value: netProceeds}("");
        require(success, "Transfer failed");

        // Send creator's share of the fee
        if (creatorShare > 0) {
            (bool creatorOk, ) = payable(token.creator).call{value: creatorShare}("");
            require(creatorOk, "Creator fee transfer failed");
            emit CreatorFeePaid(wrapperToken, token.creator, creatorShare);
        }

        // Send protocol (treasury) share of the fee
        if (protocolShare > 0) {
            (bool feeSuccess, ) = payable(treasury).call{value: protocolShare}("");
            require(feeSuccess, "Fee transfer failed");
            emit FeesCollected(wrapperToken, protocolShare);
        }

        emit TokensSold(msg.sender, wrapperToken, amount, netProceeds);
    }

    /**
     * @notice Harvests royalties from Story Protocol and pumps the bonding curve
     * @param wrapperToken Address of the wrapper token
     * @param ancestorIpId Ancestor IP ID for royalty claiming
     * @param childIpIds Array of child IP IDs
     * @param royaltyPolicies Array of royalty policy addresses
     * @param currencyTokens Array of currency token addresses to claim
     * @dev Claims royalties and injects them into the bonding curve reserve
     * @dev Raises floor price without increasing supply
     */
    function harvestAndPump(
        address wrapperToken,
        address ancestorIpId,
        address[] calldata childIpIds,
        address[] calldata royaltyPolicies,
        address[] calldata currencyTokens
    ) external nonReentrant whenNotPaused {
        require(wrapperToken != address(0), "Invalid wrapper token");
        LaunchedToken storage token = launchedTokens[wrapperToken];
        require(token.wrapperAddress != address(0), "Unknown wrapper token");

        // Only the token creator, an optionally designated harvester, or the protocol owner
        // may trigger royalty harvesting and pumping to avoid griefing and front-running.
        address harvester = tokenHarvesters[wrapperToken];
        require(
            msg.sender == token.creator ||
                msg.sender == harvester ||
                msg.sender == owner(),
            "Not authorized to harvest"
        );

        BondingCurve storage curve = bondingCurves[wrapperToken];

        // Get balance before claiming
        uint256 balanceBefore = address(this).balance;

        // Claim royalties from Story Protocol
        IRoyaltyWorkflows(royaltyWorkflows).claimAllRevenue(
            ancestorIpId,
            address(this),
            childIpIds,
            royaltyPolicies,
            currencyTokens
        );

        uint256 balanceAfter = address(this).balance;
        require(balanceAfter > balanceBefore, "No royalties claimed");

        uint256 claimedAmount = balanceAfter - balanceBefore;
        token.totalRoyaltiesHarvested += claimedAmount;

        emit RoyaltiesHarvested(wrapperToken, claimedAmount);

        // If the token is still on the bonding curve, keep pumping the reserve as before
        if (!token.graduated && curve.isActive) {
            curve.reserveBalance += claimedAmount;
            totalCurveReserves += claimedAmount;

            uint256 initialCurveSupply = token.initialCurveSupply;
            uint256 soldRaw = initialCurveSupply > curve.currentSupply
                ? (initialCurveSupply - curve.currentSupply)
                : 0;

            // Normalize sold to whole-wrapper units for pricing
            uint256 soldUnits = soldRaw / WRAP_UNIT;

            emit FloorPriceUpdated(
                wrapperToken,
                curve.basePrice + (soldUnits * curve.priceIncrement)
            );

            // Check graduation using a time-based delay on top of the market cap threshold.
            _checkGraduation(wrapperToken);
        } else {
            // If the token has graduated, use royalties for buyback-and-burn on PiperX instead of
            // injecting them into the bonding curve reserve.
            _buybackAndBurn(wrapperToken, claimedAmount);
        }
    }

    function _buybackAndBurn(address wrapperToken, uint256 wipAmount) internal {
        require(piperXRouter != address(0), "PiperX router not set");

        // Aggregate freshly claimed royalties with any previously pending buyback amount
        uint256 totalToSpend = wipAmount + pendingBuybacks[wrapperToken];
        require(totalToSpend > 0, "No WIP to spend");

        IPiperXRouter router = IPiperXRouter(piperXRouter);

        // Ensure there is a DEX pool before attempting a swap; if not, keep funds pending
        address factory = router.factory();
        address pair = IPiperXFactory(factory).getPair(wipToken, wrapperToken);

        if (pair == address(0)) {
            pendingBuybacks[wrapperToken] = totalToSpend;
            emit BuybackFailed(wrapperToken, totalToSpend);
            return;
        }

        address[] memory path = new address[](2);
        path[0] = wipToken;
        path[1] = wrapperToken;

        address burnAddress = BURN_ADDRESS;

        // Clear pending amount optimistically; if the swap fails we will restore it
        pendingBuybacks[wrapperToken] = 0;

        try
            router.swapExactETHForTokens{value: totalToSpend}(
                1, // Minimal amount out; additional slippage controls can be handled off-chain
                path,
                burnAddress,
                block.timestamp + 300 // Shorter deadline to reduce MEV window
            )
        returns (uint256[] memory amounts) {
            uint256 wrapperBought = amounts[amounts.length - 1];
            emit BuybackAndBurn(wrapperToken, totalToSpend, wrapperBought);
        } catch {
            // If the swap cannot be executed (e.g., low liquidity, price movement), keep funds pending
            pendingBuybacks[wrapperToken] = totalToSpend;
            emit BuybackFailed(wrapperToken, totalToSpend);
        }
    }

    /**
     * @notice Internal function to graduate a token to DEX
     * @param wrapperToken Address of the wrapper token to graduate
     * @dev Migrates all liquidity from bonding curve to PiperX V2
     * @dev Creates liquidity pool and burns LP tokens
     * @dev Disables bonding curve trading
     */
    function _graduate(address wrapperToken) internal {
        LaunchedToken storage token = launchedTokens[wrapperToken];
        BondingCurve storage curve = bondingCurves[wrapperToken];

        require(!token.graduated, "Already graduated");
        require(curve.isActive, "Curve not active");

        // Mark as graduated
        token.graduated = true;
        curve.isActive = false;
        isGraduated[wrapperToken] = true;

        // Get all available liquidity
        // Native side: all ETH accumulated in the bonding curve reserve
        uint256 nativeLiquidity = curve.reserveBalance;
        if (nativeLiquidity > 0) {
            totalCurveReserves -= nativeLiquidity;
            curve.reserveBalance = 0;
        }

        // Token side: use reserved DEX allocation (in RT) plus any remaining
        // unsold bonding-curve inventory (currentSupply in wrapper units).
        uint256 dexReserveWrapped = token.dexReserve * WRAP_PER_RT;
        uint256 tokenLiquidity = dexReserveWrapped + curve.currentSupply;

        require(nativeLiquidity > 0 && tokenLiquidity > 0, "No liquidity to migrate");

        // Compute minimum acceptable amounts to add, to protect against extreme slippage during migration
        uint256 minTokenLiquidity = (tokenLiquidity * DEX_LP_MIN_BPS) / BPS_DENOMINATOR;
        uint256 minNativeLiquidity = (nativeLiquidity * DEX_LP_MIN_BPS) / BPS_DENOMINATOR;

        // Approve router to pull wrapper tokens
        IERC20(wrapperToken).forceApprove(piperXRouter, tokenLiquidity);

        // Add liquidity to PiperX V2 Router
        // LP tokens are sent to burn address to lock liquidity permanently
        IPiperXRouter router = IPiperXRouter(piperXRouter);

        router.addLiquidityETH{value: nativeLiquidity}(
            wrapperToken,
            tokenLiquidity,
            minTokenLiquidity,
            minNativeLiquidity,
            BURN_ADDRESS, // Burn LP tokens
            block.timestamp + 300
        );

        address factory = router.factory();
        address weth = router.WETH();
        address poolAddress = IPiperXFactory(factory).getPair(wrapperToken, weth);

        emit Graduated(wrapperToken, nativeLiquidity, poolAddress);
    }

    /**
     * @notice Calculates the total cost to buy a given amount of tokens
     * @param wrapperToken Address of the wrapper token
     * @param amount Amount of tokens to buy
     * @return Total cost in native token (including fees)
     * @dev Uses linear bonding curve: price = basePrice + (supply * increment)
     * @dev Integrates price function over the purchase amount
     */
    function calculateBuyPrice(
        address wrapperToken,
        uint256 amount
    ) public view returns (uint256) {
        BondingCurve memory curve = bondingCurves[wrapperToken];
        require(curve.isActive, "Curve not active");
        require(amount > 0, "Amount must be greater than zero");
        require(curve.currentSupply >= amount, "Insufficient supply");
        require(amount % WRAP_UNIT == 0, "Invalid amount step");

        // Compute circulating supply (tokens sold) in wrapper units
        LaunchedToken memory token = launchedTokens[wrapperToken];
        uint256 initialCurveSupply = token.initialCurveSupply;
        uint256 soldRaw = initialCurveSupply > curve.currentSupply
            ? (initialCurveSupply - curve.currentSupply)
            : 0;

        // Normalize to whole-wrapper units for pricing math
        uint256 soldUnits = soldRaw / WRAP_UNIT;
        uint256 amountUnits = amount / WRAP_UNIT;

        // Linear bonding curve based on soldUnits:
        // price(sold) = basePrice + (sold * increment)
        // Cost for buying `amountUnits` = basePrice * amountUnits
        //   + priceIncrement * (soldUnits * amountUnits + amountUnits^2 / 2)
        uint256 baseCost = curve.basePrice * amountUnits;
        uint256 incrementCost =
            (curve.priceIncrement * soldUnits * amountUnits) +
            (curve.priceIncrement * amountUnits * amountUnits) / 2;

        // Return raw bonding-curve cost before trading fees are applied
        return baseCost + incrementCost;
    }

    /**
     * @notice Calculates the total proceeds from selling a given amount of tokens
     * @param wrapperToken Address of the wrapper token
     * @param amount Amount of tokens to sell
     * @return Total proceeds in native token (before fees)
     * @dev Uses linear bonding curve: price = basePrice + (supply * increment)
     * @dev Integrates price function over the sale amount
     */
    function calculateSellPrice(
        address wrapperToken,
        uint256 amount
    ) public view returns (uint256) {
        BondingCurve memory curve = bondingCurves[wrapperToken];
        require(curve.isActive, "Curve not active");
        require(amount > 0, "Amount must be greater than zero");
        require(amount % WRAP_UNIT == 0, "Invalid amount step");

        // Compute circulating supply (tokens sold) in wrapper units
        LaunchedToken memory token = launchedTokens[wrapperToken];
        uint256 initialCurveSupply = token.initialCurveSupply;
        uint256 soldRaw = initialCurveSupply > curve.currentSupply
            ? (initialCurveSupply - curve.currentSupply)
            : 0;

        require(soldRaw >= amount, "Insufficient circulating supply");

        // Normalize to whole-wrapper units
        uint256 soldUnits = soldRaw / WRAP_UNIT;
        uint256 amountUnits = amount / WRAP_UNIT;

        // Linear bonding curve based on soldUnits:
        // price(sold) = basePrice + (sold * increment)
        // Proceeds for selling `amountUnits` = basePrice * amountUnits
        //   + priceIncrement * (soldUnits * amountUnits - amountUnits^2 / 2)
        uint256 baseProceeds = curve.basePrice * amountUnits;
        uint256 incrementProceeds =
            (curve.priceIncrement * soldUnits * amountUnits) -
            (curve.priceIncrement * amountUnits * amountUnits) / 2;

        return baseProceeds + incrementProceeds;
    }

    /**
     * @notice Gets the current market cap of a token
     * @param wrapperToken Address of the wrapper token
     * @return Market cap in native token
     * @dev Market cap = current price * total supply
     */
    function getMarketCap(address wrapperToken) public view returns (uint256) {
        BondingCurve memory curve = bondingCurves[wrapperToken];
        if (!curve.isActive) return 0;

        LaunchedToken memory token = launchedTokens[wrapperToken];

        // Total wrapper supply in whole-wrapper units
        uint256 totalWrapped = token.totalLocked * WRAP_PER_RT;
        uint256 totalSupplyUnits = totalWrapped / WRAP_UNIT;

        // Current price based on circulating supply (tokens sold) in whole-wrapper units
        uint256 initialCurveSupply = token.initialCurveSupply;
        uint256 soldRaw = initialCurveSupply > curve.currentSupply
            ? (initialCurveSupply - curve.currentSupply)
            : 0;
        uint256 soldUnits = soldRaw / WRAP_UNIT;

        uint256 currentPrice = curve.basePrice + (soldUnits * curve.priceIncrement);

        return currentPrice * totalSupplyUnits;
    }

    /**
     * @notice Gets comprehensive token information
     * @param wrapperToken Address of the wrapper token
     * @return Token information struct
     */
    function getTokenInfo(
        address wrapperToken
    ) external view returns (LaunchedToken memory) {
        return launchedTokens[wrapperToken];
    }

    /**
     * @notice Gets bonding curve information
     * @param wrapperToken Address of the wrapper token
     * @return Bonding curve struct
     */
    function getBondingCurve(
        address wrapperToken
    ) external view returns (BondingCurve memory) {
        return bondingCurves[wrapperToken];
    }

    /**
     * @notice Gets current price for buying 1 token
     * @param wrapperToken Address of the wrapper token
     * @return Price in native token
     */
    function getCurrentPrice(address wrapperToken) external view returns (uint256) {
        BondingCurve memory curve = bondingCurves[wrapperToken];
        if (!curve.isActive) return 0;
        LaunchedToken memory token = launchedTokens[wrapperToken];
        uint256 initialCurveSupply = token.initialCurveSupply;
        uint256 soldRaw = initialCurveSupply > curve.currentSupply
            ? (initialCurveSupply - curve.currentSupply)
            : 0;

        uint256 soldUnits = soldRaw / WRAP_UNIT;

        return curve.basePrice + (soldUnits * curve.priceIncrement);
    }

    /**
     * @notice Updates treasury address
     * @param newTreasury New treasury address
     * @dev Only owner can call
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }

    /**
     * @notice Updates graduation threshold
     * @param newThreshold New graduation threshold in wei
     * @dev Only owner can call
     */
    function updateGraduationThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0, "Invalid threshold");
        graduationThreshold = newThreshold;
    }

    /**
     * @notice Updates PiperX router address
     * @param newRouter New router address
     * @dev Only owner can call
     */
    function updatePiperXRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router");
        piperXRouter = newRouter;
    }

    /**
     * @notice Emergency withdraw function for owner
     * @param token Address of token to withdraw (address(0) for native token)
     * @param to Address to send tokens to
     * @param amount Amount to withdraw (0 for all)
     * @dev Only owner can call
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");

        if (token == address(0)) {
            // Withdraw native token, but never touch bonding curve reserves
            require(
                address(this).balance >= totalCurveReserves,
                "Inconsistent reserves"
            );

            uint256 freeBalance = address(this).balance - totalCurveReserves;
            require(freeBalance > 0, "No free native balance");

            uint256 withdrawAmount = amount == 0 ? freeBalance : amount;
            require(withdrawAmount <= freeBalance, "Amount exceeds free balance");

            (bool success, ) = payable(to).call{value: withdrawAmount}("");
            require(success, "Transfer failed");
        } else {
            // Withdraw ERC20 token
            IERC20 erc20 = IERC20(token);
            // Disallow withdrawing wrapper tokens created by this launchpad
            if (launchedTokens[token].wrapperAddress != address(0)) {
                revert("Cannot withdraw wrapper tokens");
            }

            // Disallow withdrawing underlying RT vault tokens
            if (rtToWrapper[token] != address(0)) {
                revert("Cannot withdraw RT vault tokens");
            }

            uint256 withdrawAmount = amount == 0 ? erc20.balanceOf(address(this)) : amount;
            erc20.safeTransfer(to, withdrawAmount);
        }
    }

    /**
     * @notice Pauses the contract
     * @dev Only owner can call
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract
     * @dev Only owner can call
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Gets total number of launched tokens
     * @return Count of launched tokens
     */
    function getLaunchedTokenCount() external view returns (uint256) {
        return allLaunchedTokens.length;
    }

    /**
     * @notice Gets all launched token addresses
     * @return Array of wrapper token addresses
     */
    function getAllLaunchedTokens() external view returns (address[] memory) {
        return allLaunchedTokens;
    }

    /**
     * @notice Receives native token (for bonding curve purchases)
     */
    receive() external payable {
        // Contract can receive native token for bonding curve operations
    }
}