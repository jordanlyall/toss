// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Free-mint ERC-721 for Toss demo. On-chain SVG, deterministic from tokenId.
/// @dev 32-byte keccak hash of tokenId drives a glyph grid. No storage writes at mint.
contract DemoNFT is ERC721 {
    using Strings for uint256;

    uint256 public nextId;

    uint256 private constant VIEW_SIZE = 2100;
    uint256 private constant PAD = 210;
    uint256 private constant GRID_AREA = 1680;
    uint256 private constant DENSITY_THRESHOLD = 216; // 0.85 * 255

    constructor() ERC721("Toss Glyph Grid", "TOSS") {}

    function mint() external returns (uint256 id) {
        id = nextId++;
        _safeMint(msg.sender, id);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory svg = _render(tokenId);
        string memory json = string(
            abi.encodePacked(
                '{"name":"Toss #',
                tokenId.toString(),
                '","description":"An on-chain glyph grid, deterministic from tokenId. Toss.",',
                '"image":"data:image/svg+xml;base64,',
                Base64.encode(bytes(svg)),
                '"}'
            )
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _render(uint256 tokenId) internal pure returns (string memory) {
        bytes32 h = keccak256(abi.encodePacked(tokenId));
        uint8 g = uint8(h[0]);

        uint256 paletteIdx = uint256(g & 0x07);
        if (paletteIdx >= 6) paletteIdx = paletteIdx % 6;
        uint256 N = 4 + ((g >> 3) & 0x03);
        uint256 strokeTier = 1 + ((g >> 5) & 0x03);
        bool outerRing = (g & 0x80) != 0;

        uint256 cellSize = GRID_AREA / N;
        uint256 baseStroke = (cellSize * 35) / 1000;
        uint256 sw = (baseStroke * (60 + strokeTier * 35)) / 100;
        if (sw == 0) sw = 1;

        (string memory bg, string memory ink0, string memory ink1, string memory ink2) = _palette(paletteIdx);

        bytes memory buf = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ',
            VIEW_SIZE.toString(),
            " ",
            VIEW_SIZE.toString(),
            '" shape-rendering="geometricPrecision">',
            '<rect width="',
            VIEW_SIZE.toString(),
            '" height="',
            VIEW_SIZE.toString(),
            '" fill="',
            bg,
            '"/>'
        );

        if (outerRing) {
            uint256 ri = (PAD * 35) / 100;
            uint256 rsw = (sw * 80) / 100;
            if (rsw == 0) rsw = 1;
            buf = abi.encodePacked(
                buf,
                '<rect x="',
                ri.toString(),
                '" y="',
                ri.toString(),
                '" width="',
                (VIEW_SIZE - ri * 2).toString(),
                '" height="',
                (VIEW_SIZE - ri * 2).toString(),
                '" fill="none" stroke="',
                ink0,
                '" stroke-width="',
                rsw.toString(),
                '" rx="8"/>'
            );
        }

        uint256 cellCount = N * N;
        for (uint256 i = 0; i < cellCount; i++) {
            uint8 nibble = _nibble(h, i);
            uint8 densByte = uint8(h[(i + 17) % 32]);
            if (densByte > DENSITY_THRESHOLD) continue;

            uint8 glyphType = nibble & 0x07;
            bool inkAlt = (nibble & 0x08) != 0;
            uint256 inkIdx = i % 3;
            if (inkAlt) inkIdx = (inkIdx + 1) % 3;
            string memory ink = inkIdx == 0 ? ink0 : (inkIdx == 1 ? ink1 : ink2);

            uint256 gx = i % N;
            uint256 gy = i / N;
            uint256 cx = PAD + gx * cellSize + cellSize / 2;
            uint256 cy = PAD + gy * cellSize + cellSize / 2;
            uint256 glyphSize = (cellSize * 64) / 100;

            buf = abi.encodePacked(buf, _glyph(glyphType, cx, cy, glyphSize, ink, sw));
        }

        buf = abi.encodePacked(buf, "</svg>");
        return string(buf);
    }

    /// @dev Extract a 4-bit nibble for cell `i`. Bytes 1..31 pack two nibbles each.
    function _nibble(bytes32 h, uint256 i) internal pure returns (uint8) {
        uint256 bitOffset = i * 4;
        uint256 byteIdx = 1 + (bitOffset / 8);
        uint8 b = uint8(h[byteIdx]);
        return (bitOffset % 8) == 0 ? (b >> 4) & 0x0F : b & 0x0F;
    }

    function _palette(uint256 idx) internal pure returns (string memory bg, string memory i0, string memory i1, string memory i2) {
        if (idx == 0) return ("#faf9f5", "#141413", "#d97757", "#6a9bcc"); // Paper
        if (idx == 1) return ("#fef6e4", "#d35400", "#f39c12", "#16a085"); // Sun
        if (idx == 2) return ("#eaf6f6", "#0d3b66", "#06a3d9", "#fe5f55"); // Ocean
        if (idx == 3) return ("#f2f5e9", "#2e4d3a", "#bf4e30", "#e6b88a"); // Forest
        if (idx == 4) return ("#f5f1e8", "#1a1a1a", "#8b0000", "#2d4a66"); // Noir
        return ("#0d0d0d", "#ff2e63", "#08d9d6", "#ffd93d"); // Neon
    }

    function _glyph(uint8 t, uint256 cx, uint256 cy, uint256 size, string memory ink, uint256 sw) internal pure returns (bytes memory) {
        uint256 r = size / 2;
        string memory swStr = sw.toString();

        if (t == 0) {
            uint256 rd = (size * 275) / 1000;
            return abi.encodePacked(
                '<circle cx="', cx.toString(), '" cy="', cy.toString(),
                '" r="', rd.toString(), '" fill="', ink, '"/>'
            );
        } else if (t == 1) {
            uint256 rd = (size * 375) / 1000;
            return abi.encodePacked(
                '<circle cx="', cx.toString(), '" cy="', cy.toString(),
                '" r="', rd.toString(), '" fill="none" stroke="', ink,
                '" stroke-width="', swStr, '"/>'
            );
        } else if (t == 2) {
            uint256 arm = (r * 85) / 100;
            return abi.encodePacked(
                '<line x1="', (cx - arm).toString(), '" y1="', cy.toString(),
                '" x2="', (cx + arm).toString(), '" y2="', cy.toString(),
                '" stroke="', ink, '" stroke-width="', swStr, '"/>',
                '<line x1="', cx.toString(), '" y1="', (cy - arm).toString(),
                '" x2="', cx.toString(), '" y2="', (cy + arm).toString(),
                '" stroke="', ink, '" stroke-width="', swStr, '"/>'
            );
        } else if (t == 3) {
            uint256 off = (r * 80) / 100;
            return abi.encodePacked(
                '<line x1="', (cx - off).toString(), '" y1="', (cy + off).toString(),
                '" x2="', (cx + off).toString(), '" y2="', (cy - off).toString(),
                '" stroke="', ink, '" stroke-width="', swStr, '"/>'
            );
        } else if (t == 4) {
            uint256 off = (r * 80) / 100;
            return abi.encodePacked(
                '<line x1="', (cx - off).toString(), '" y1="', (cy - off).toString(),
                '" x2="', (cx + off).toString(), '" y2="', (cy + off).toString(),
                '" stroke="', ink, '" stroke-width="', swStr, '"/>'
            );
        } else if (t == 5) {
            uint256 th = (r * 90) / 100;
            uint256 tw = (th * 1732) / 1000;
            uint256 halfW = tw / 2;
            uint256 baseY = cy + ((th * 60) / 100);
            return abi.encodePacked(
                '<polygon points="', cx.toString(), ',', (cy - th).toString(),
                " ", (cx - halfW).toString(), ',', baseY.toString(),
                " ", (cx + halfW).toString(), ',', baseY.toString(),
                '" fill="none" stroke="', ink, '" stroke-width="', swStr, '"/>'
            );
        } else if (t == 6) {
            uint256 sq = (r * 140) / 100;
            uint256 half = sq / 2;
            return abi.encodePacked(
                '<rect x="', (cx - half).toString(), '" y="', (cy - half).toString(),
                '" width="', sq.toString(), '" height="', sq.toString(),
                '" fill="none" stroke="', ink, '" stroke-width="', swStr, '"/>'
            );
        } else {
            uint256 cw = (r * 85) / 100;
            uint256 ch = (r * 60) / 100;
            return abi.encodePacked(
                '<polyline points="', (cx - cw).toString(), ',', (cy - ch).toString(),
                " ", cx.toString(), ',', (cy + ch).toString(),
                " ", (cx + cw).toString(), ',', (cy - ch).toString(),
                '" fill="none" stroke="', ink, '" stroke-width="', swStr, '"/>'
            );
        }
    }
}
