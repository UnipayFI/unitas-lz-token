// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Create2Factory is Ownable {
    mapping(address => bool) public operators;

    event OperatorSet(address indexed operator, bool allowed);
    event Deployed(address indexed addr, bytes32 indexed salt, bytes32 indexed initCodeHash);

    error NotAuthorized();
    error DeployFailed();
    error AlreadyDeployed(address addr);
    error DeployedAddressMismatch(address created, address expected);

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyOwnerOrOperator() {
        if (msg.sender != owner() && !operators[msg.sender]) revert NotAuthorized();
        _;
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function deploy(bytes32 salt, bytes memory initCode) external onlyOwnerOrOperator returns (address addr) {
        bytes32 initCodeHash = keccak256(initCode);
        addr = computeAddress(salt, initCodeHash);

        if (addr.code.length != 0) revert AlreadyDeployed(addr);

        address created;
        assembly {
            created := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if (created == address(0)) revert DeployFailed();
        if (created != addr) revert DeployedAddressMismatch(created, addr);

        emit Deployed(created, salt, initCodeHash);
        return created;
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) public view returns (address) {
        bytes32 h = keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash));
        return address(uint160(uint256(h)));
    }
}
