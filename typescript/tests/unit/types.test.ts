/**
 * Phase 1 verification: type compilation, immutability, and discrimination
 * assertions for the Desktop, Store, AI/ML, and Web3 contracts.
 *
 * Compile-time assertions use `expectTypeOf` and `@ts-expect-error` markers,
 * both validated by `tsc --noEmit -p tsconfig.test.json` (markers fail the
 * build if the expected error is absent). Runtime assertions execute under
 * Vitest.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
    AppIsolationTier,
    AppManifest,
    AppPlacement,
    HexAddress,
    MaximizeTarget,
    ModelConfig,
    SafeBounds,
    SSEStreamEvent,
    StoreChangeListener,
    StoreOptions,
    SWROptions,
    Web3TransactionDetails,
    WindowState,
} from '../../src/types/index.js';

const PLACEMENTS: readonly AppPlacement[] = ['dock', 'topdock', 'both', 'hidden'];
const TIERS: readonly AppIsolationTier[] = ['native', 'isolated'];

describe('AppManifest type contract', () => {
    it('accepts a valid immutable manifest', () => {
        const manifest: AppManifest = {
            id: 'dashboard',
            title: 'Dashboard',
            label: 'Dash',
            icon: 'layout-dashboard',
            placement: 'dock',
            tier: 'native',
            src: '/app/dashboard.html',
            c1: '#fbe482',
            c2: '#000000',
            maxCount: 3,
            maximized: false,
            trustedHtml: false,
            content: (section, label, icon) => `${section}:${label}:${icon ?? 'none'}`,
        };
        expect(manifest.id).toBe('dashboard');
        expect(manifest.title).toBe('Dashboard');
        expect(manifest.content?.('overview', 'Overview', 'gauge')).toBe('overview:Overview:gauge');
        expect(PLACEMENTS).toContain(manifest.placement);
        expect(TIERS).toContain(manifest.tier);
        expectTypeOf(manifest.maxCount).toEqualTypeOf<number | undefined>();
    });

    it('rejects a missing id/title and an invalid placement at compile time', () => {
        // @ts-expect-error: id is required
        const missingId: AppManifest = { title: 'Dashboard' };
        // @ts-expect-error: title is required
        const missingTitle: AppManifest = { id: 'x', icon: 'x' };
        // @ts-expect-error: placement must be a member of AppPlacement
        const badPlacement: AppManifest = { id: 'x', title: 'x', placement: 'floating' };
        void missingId;
        void missingTitle;
        void badPlacement;
    });
});

describe('Window geometry types', () => {
    it('models serialized window state, safe bounds, and maximize targets', () => {
        const state: WindowState = {
            id: 'analytics', x: 10, y: 20, w: 760, h: 540,
            minimized: false, zoomed: false, title: 'Analytics',
        };
        const bounds: SafeBounds = { top: 2, bottom: 900, left: 0, right: 1280 };
        const target: MaximizeTarget = { top: 0, left: 8, width: 1264, height: 890, halfWidth: 632 };

        state.x = 100;
        expect(state.x).toBe(100);
        expect(state.id).toBe('analytics');
        expect(bounds.right).toBe(1280);
        expect(target.halfWidth).toBe(632);
        expectTypeOf(state.zoomed).toBeBoolean();
    });

    it('keeps the window id read-only at compile time', () => {
        const state: WindowState = {
            id: 'analytics', x: 0, y: 0, w: 760, h: 540,
            minimized: false, zoomed: false, title: 'Analytics',
        };
        // @ts-expect-error: id is read-only
        state.id = 'other';
        void state;
    });
});

describe('SSEStreamEvent discriminated union', () => {
    /** Exhaustive narrowing helper: tsc fails if a variant is unhandled. */
    function describeEvent(event: SSEStreamEvent): string {
        switch (event.type) {
            case 'token_delta': return `token:${event.text}:${event.tokenCount}`;
            case 'tool_call_start': return `tool:${event.toolName}`;
            case 'vector_search_result': return `vector:${event.chunks.length}`;
            case 'finish': return `finish:${event.reason}:${event.totalTokens}`;
            case 'error': return `error:${event.code}`;
        }
    }

    it('narrows every variant without casts', () => {
        const events: readonly SSEStreamEvent[] = [
            { type: 'token_delta', text: 'Hello', tokenCount: 5 },
            { type: 'tool_call_start', toolName: 'vector_search', input: { query: 'x' } },
            { type: 'vector_search_result', chunks: [{ id: 'v1', score: 0.95, text: 'doc' }] },
            { type: 'finish', reason: 'stop', totalTokens: 128 },
            { type: 'error', code: 'rate_limit', message: 'slow down' },
        ];

        expect(describeEvent(events[0])).toBe('token:Hello:5');
        expect(describeEvent(events[1])).toBe('tool:vector_search');
        expect(describeEvent(events[2])).toBe('vector:1');
        expect(describeEvent(events[3])).toBe('finish:stop:128');
        expect(describeEvent(events[4])).toBe('error:rate_limit');
    });

    it('rejects unknown event types and wrong variant fields at compile time', () => {
        // @ts-expect-error: 'heartbeat' is not a member of the SSEStreamEvent union
        const unknown: SSEStreamEvent = { type: 'heartbeat', data: 1 };
        // @ts-expect-error: token_delta requires the `text` field
        const missingText: SSEStreamEvent = { type: 'token_delta', tokenCount: 0 };
        // @ts-expect-error: finish reason must be 'stop' | 'length' | 'tool_calls'
        const badReason: SSEStreamEvent = { type: 'finish', reason: 'complete', totalTokens: 1 };
        void unknown;
        void missingText;
        void badReason;
    });
});

describe('ModelConfig type contract', () => {
    it('accepts AI/ML model options', () => {
        const config: ModelConfig = {
            modelId: 'deepseek-chat',
            temperature: 0.7,
            topP: 1,
            maxTokens: 4096,
            presencePenalty: 0,
            frequencyPenalty: 0,
            responseFormat: { type: 'json_object' },
            tools: [{ name: 'web_search', description: 'Search the web', parameters: { top_k: 5 } }],
        };
        expect(config.modelId).toBe('deepseek-chat');
        expect(config.maxTokens).toBe(4096);
        expect(config.tools?.[0]?.name).toBe('web_search');
        expectTypeOf(config.temperature).toBeNumber();
    });

    it('rejects missing required fields and an unknown response format at compile time', () => {
        // @ts-expect-error: modelId is required
        const noModel: ModelConfig = { temperature: 0.5, topP: 1, maxTokens: 100 };
        // @ts-expect-error: responseFormat.type must be 'json_object' | 'text'
        const badFormat: ModelConfig = { modelId: 'x', temperature: 0.5, topP: 1, maxTokens: 100, responseFormat: { type: 'xml' } };
        // @ts-expect-error: maxTokens must be a number
        const badTokens: ModelConfig = { modelId: 'x', temperature: 0.5, topP: 1, maxTokens: '4096' };
        void noModel;
        void badFormat;
        void badTokens;
    });
});

describe('Store type contracts', () => {
    it('models SWR options and store change listeners', () => {
        const storeOpts: StoreOptions = { persistKey: 'app_user' };
        const swrOpts: SWROptions = { ttl: 30000, force: false, staleWhileRevalidate: true };

        type UserState = { name: string; theme: 'light' | 'dark' };
        const onChange: StoreChangeListener<UserState> = (prop, value, prev, target) => {
            void prev;
            void target;
            expect(typeof prop).toBe('string');
            expect(value).toBeDefined();
        };
        onChange('theme', 'dark', 'light', { name: 'Alice', theme: 'dark' });

        expect(storeOpts.persistKey).toBe('app_user');
        expect(swrOpts.force).toBe(false);
        expectTypeOf(onChange).toMatchTypeOf<StoreChangeListener<UserState>>();
    });
});

describe('Web3 type contracts', () => {
    it('enforces 0x-prefixed hex addresses and bigint transaction values', () => {
        const address: HexAddress = '0x0123456789abcdef0123456789abcdef01234567';
        const tx: Web3TransactionDetails = {
            action: 'approve',
            to: address,
            value: 1_000_000_000_000_000_000n,
            data: '0xdeadbeef',
            chainId: 1,
        };
        expect(tx.value).toBe(1_000_000_000_000_000_000n);
        expect(tx.chainId).toBe(1);
        expectTypeOf(tx.value).toBeBigInt();
        expectTypeOf(tx.chainId).toBeNumber();
    });

    it('rejects malformed addresses and missing fields at compile time', () => {
        // @ts-expect-error: action is required
        const noAction: Web3TransactionDetails = { to: '0x0123456789abcdef0123456789abcdef01234567', value: 1n, chainId: 1 };
        // @ts-expect-error: addresses must be 0x-prefixed hex strings
        const badAddress: HexAddress = '0123456789abcdef0123456789abcdef01234567';
        // @ts-expect-error: transaction values are bigint, never number
        const badValue: Web3TransactionDetails = { action: 'approve', to: '0x0123456789abcdef0123456789abcdef01234567', value: 1000, chainId: 1 };
        // @ts-expect-error: chainId is a number, not bigint
        const badChainId: Web3TransactionDetails = { action: 'approve', to: '0x0123456789abcdef0123456789abcdef01234567', value: 1n, chainId: 1n };
        void noAction;
        void badAddress;
        void badValue;
        void badChainId;
    });
});
