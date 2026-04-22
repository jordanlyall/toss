// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Minimal free-mint ERC-721 for demo purposes.
contract DemoNFT is ERC721 {
    uint256 public nextId;
    string private _baseTokenURI;

    constructor(string memory baseURI) ERC721("Toss Demo", "TOSS") {
        _baseTokenURI = baseURI;
    }

    function mint() external returns (uint256 id) {
        id = nextId++;
        _safeMint(msg.sender, id);
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
}
