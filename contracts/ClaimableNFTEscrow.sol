// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title ClaimableNFTEscrow
 * @notice Sender deposits an ERC-721 with a secret hash. Anyone holding the
 *         secret can claim the NFT to an address of their choice. Sender can
 *         revoke before claim.
 *
 * Flow:
 *   1. Sender computes secret off-chain, hashes it, calls deposit()
 *   2. Sender shares (id, secret) out of band (iMessage, link, etc.)
 *   3. Recipient calls claim(id, secret) - NFT transfers to msg.sender
 *
 * Production TODO: to prevent mempool front-running of claim() where an
 * observer extracts the secret and claims to their own address, bind the
 * recipient into a signature. Simplest version: secret is a private key,
 * recipient signs claim message, contract verifies signature. Omitted here
 * for prototype clarity.
 */
contract ClaimableNFTEscrow {
    struct Escrow {
        address sender;
        address nftContract;
        uint256 tokenId;
        bytes32 secretHash;
        uint64 expiresAt;
        bool settled; // claimed OR revoked
    }

    mapping(uint256 => Escrow) public escrows;
    uint256 public nextId;

    event Deposited(
        uint256 indexed id,
        address indexed sender,
        address indexed nftContract,
        uint256 tokenId,
        uint64 expiresAt
    );
    event Claimed(uint256 indexed id, address indexed recipient);
    event Revoked(uint256 indexed id);

    function deposit(
        address nftContract,
        uint256 tokenId,
        bytes32 secretHash,
        uint64 expiresAt
    ) external returns (uint256 id) {
        require(expiresAt > block.timestamp, "expiresAt in past");
        require(secretHash != bytes32(0), "empty secretHash");

        id = nextId++;
        escrows[id] = Escrow({
            sender: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            secretHash: secretHash,
            expiresAt: expiresAt,
            settled: false
        });

        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        emit Deposited(id, msg.sender, nftContract, tokenId, expiresAt);
    }

    function claim(uint256 id, bytes32 secret) external {
        Escrow storage e = escrows[id];
        require(!e.settled, "settled");
        require(block.timestamp <= e.expiresAt, "expired");
        require(keccak256(abi.encodePacked(secret)) == e.secretHash, "bad secret");

        e.settled = true;
        IERC721(e.nftContract).transferFrom(address(this), msg.sender, e.tokenId);
        emit Claimed(id, msg.sender);
    }

    function revoke(uint256 id) external {
        Escrow storage e = escrows[id];
        require(msg.sender == e.sender, "not sender");
        require(!e.settled, "settled");

        e.settled = true;
        IERC721(e.nftContract).transferFrom(address(this), e.sender, e.tokenId);
        emit Revoked(id);
    }

    function getEscrow(uint256 id) external view returns (Escrow memory) {
        return escrows[id];
    }
}
