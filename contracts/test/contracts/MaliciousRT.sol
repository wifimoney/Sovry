// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MaliciousRT
 * @notice A malicious ERC20 token that attempts reentrancy during transferFrom
 * @dev Used to test reentrancy protection in SovryLaunchpad
 */
contract MaliciousRT is ERC20 {
    address public immutable launchpad;
    bool public shouldAttack = true;
    
    event AttackAttempted(address to, uint256 amount);
    
    constructor(address _launchpad) ERC20("Malicious RT", "MALRT") {
        launchpad = _launchpad;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @notice Malicious transferFrom that attempts reentrancy
     */
    function transferFrom(address from, address to, uint256 amount) 
        public override returns (bool) 
    {
        // Only attack when transferring to the launchpad
        if (shouldAttack && to == launchpad) {
            emit AttackAttempted(to, amount);
            
            // Attempt reentrancy by calling a function that should fail
            // This simulates an attack and should be caught by ReentrancyGuard
            this.attemptReentrancy();
        }
        
        // Perform the actual transfer
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }
    
    /**
     * @notice Function to attempt reentrancy
     */
    function attemptReentrancy() external {
        // This function being called during transferFrom indicates reentrancy
        // In a real attack, this would call back into the launchpad
        revert("Reentrancy detected");
    }
    
    /**
     * @notice Disable attack for normal operation
     */
    function disableAttack() external {
        shouldAttack = false;
    }
    
    /**
     * @notice Enable attack
     */
    function enableAttack() external {
        shouldAttack = true;
    }
}
