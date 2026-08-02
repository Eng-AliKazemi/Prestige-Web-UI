/**
 * Web3 primitive type contracts: checksummed hex addresses (EIP-55) and
 * transaction details with exact bigint value handling. Matches
 * `docs/TYPESCRIPT.md` Phase 1.
 */

/** EIP-55 checksummed Ethereum-style address: a 40-hex-char string with a `0x` prefix. */
export type HexAddress = `0x${string}`;

/**
 * Immutable transaction details used by `web3TransactionGuard`.
 *
 * `value` is `bigint` (never floating-point `number`) to preserve exact wei
 * precision; `chainId` is the EIP-155 numeric chain identifier.
 */
export interface Web3TransactionDetails {
    /** Human-readable action label shown on the security overlay. */
    readonly action: string;
    /** Destination address (required). */
    readonly to: HexAddress;
    /** Value to transfer in wei. */
    readonly value: bigint;
    /** Optional calldata payload for contract calls. */
    readonly data?: HexAddress;
    /** EIP-155 chain identifier. */
    readonly chainId: number;
}
