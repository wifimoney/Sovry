// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockRoyaltyWorkflows {
    function claimAllRevenue(
        address ancestorIpId,
        address claimer,
        address[] calldata childIpIds,
        address[] calldata royaltyPolicies,
        address[] calldata currencyTokens
    ) external returns (uint256[] memory amountsClaimed) {
        // Simulasi: Kirim balik WIP ke claimer (Smart Contract Launchpad)
        // Asumsi: Kontrak ini sudah didanai WIP sebelumnya
        uint256 amount = 1 ether; 
        (bool success, ) = claimer.call{value: amount}(""); 
        require(success, "Mock claim failed");
        
        amountsClaimed = new uint256[](1);
        amountsClaimed[0] = amount;
        return amountsClaimed;
    }
    
    // Fungsi untuk mendanai mock ini agar bisa bayar claim
    receive() external payable {}
}
