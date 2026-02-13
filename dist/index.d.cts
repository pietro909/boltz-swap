import { Transaction, NetworkName, IWallet, ArkProvider, IndexerProvider, VHTLC, TapLeafScript, MessageHandler, RequestEnvelope, ResponseEnvelope, IReadonlyWallet } from '@arkade-os/sdk';
import { Transaction as Transaction$1 } from '@scure/btc-signer';

interface SwapProviderConfig {
    apiUrl?: string;
    network: Network;
    referralId?: string;
}
type BoltzSwapStatus = "invoice.expired" | "invoice.failedToPay" | "invoice.paid" | "invoice.pending" | "invoice.set" | "invoice.settled" | "swap.created" | "swap.expired" | "transaction.claim.pending" | "transaction.claimed" | "transaction.confirmed" | "transaction.failed" | "transaction.lockupFailed" | "transaction.mempool" | "transaction.refunded";
declare const isSubmarineFinalStatus: (status: BoltzSwapStatus) => boolean;
declare const isReverseFinalStatus: (status: BoltzSwapStatus) => boolean;
declare const isReverseClaimableStatus: (status: BoltzSwapStatus) => boolean;
declare const isPendingReverseSwap: (swap: PendingSubmarineSwap | PendingReverseSwap) => swap is PendingReverseSwap;
declare const isPendingSubmarineSwap: (swap: PendingSubmarineSwap | PendingReverseSwap) => swap is PendingSubmarineSwap;
declare const isSubmarineRefundableStatus: (status: BoltzSwapStatus) => boolean;
declare const isSubmarineSwapRefundable: (swap: PendingSubmarineSwap | PendingReverseSwap) => swap is PendingSubmarineSwap;
type GetReverseSwapTxIdResponse = {
    id: string;
    hex?: string;
    timeoutBlockHeight: number;
};
type GetSwapStatusResponse = {
    status: BoltzSwapStatus;
    zeroConfRejected?: boolean;
    transaction?: {
        id: string;
        hex?: string;
        eta?: number;
        preimage?: string;
    };
};
type CreateSubmarineSwapRequest = {
    invoice: string;
    refundPublicKey: string;
};
type CreateSubmarineSwapResponse = {
    id: string;
    address: string;
    expectedAmount: number;
    claimPublicKey: string;
    acceptZeroConf: boolean;
    timeoutBlockHeights: {
        refund: number;
        unilateralClaim: number;
        unilateralRefund: number;
        unilateralRefundWithoutReceiver: number;
    };
};
type GetSwapPreimageResponse = {
    preimage: string;
};
type CreateReverseSwapRequest = {
    claimPublicKey: string;
    invoiceAmount: number;
    preimageHash: string;
    /** Optional description forwarded to Boltz as the invoice description. May be omitted or subject to provider-side limits. */
    description?: string;
};
type CreateReverseSwapResponse = {
    id: string;
    invoice: string;
    onchainAmount: number;
    lockupAddress: string;
    refundPublicKey: string;
    timeoutBlockHeights: {
        refund: number;
        unilateralClaim: number;
        unilateralRefund: number;
        unilateralRefundWithoutReceiver: number;
    };
};
type Leaf = {
    version: number;
    output: string;
};
type Tree = {
    claimLeaf: Leaf;
    refundLeaf: Leaf;
    refundWithoutBoltzLeaf: Leaf;
    unilateralClaimLeaf: Leaf;
    unilateralRefundLeaf: Leaf;
    unilateralRefundWithoutBoltzLeaf: Leaf;
};
type Details = {
    tree: Tree;
    amount?: number;
    keyIndex: number;
    transaction?: {
        id: string;
        vout: number;
    };
    lockupAddress: string;
    serverPublicKey: string;
    timeoutBlockHeight: number;
    preimageHash?: string;
};
type RestoredSubmarineSwap = {
    to: "BTC";
    id: string;
    from: "ARK";
    type: "submarine";
    createdAt: number;
    preimageHash: string;
    status: BoltzSwapStatus;
    refundDetails: Details;
};
type RestoredReverseSwap = {
    to: "ARK";
    id: string;
    from: "BTC";
    type: "reverse";
    createdAt: number;
    preimageHash: string;
    status: BoltzSwapStatus;
    claimDetails: Details;
};
type CreateSwapsRestoreResponse = (RestoredReverseSwap | RestoredSubmarineSwap)[];
declare class BoltzSwapProvider {
    private readonly wsUrl;
    private readonly apiUrl;
    private readonly network;
    private readonly referralId?;
    constructor(config: SwapProviderConfig);
    getApiUrl(): string;
    getWsUrl(): string;
    getNetwork(): Network;
    getFees(): Promise<FeesResponse>;
    getLimits(): Promise<LimitsResponse>;
    getReverseSwapTxId(id: string): Promise<GetReverseSwapTxIdResponse>;
    getSwapStatus(id: string): Promise<GetSwapStatusResponse>;
    getSwapPreimage(id: string): Promise<GetSwapPreimageResponse>;
    createSubmarineSwap({ invoice, refundPublicKey, }: CreateSubmarineSwapRequest): Promise<CreateSubmarineSwapResponse>;
    createReverseSwap({ invoiceAmount, claimPublicKey, preimageHash, description, }: CreateReverseSwapRequest): Promise<CreateReverseSwapResponse>;
    refundSubmarineSwap(swapId: string, transaction: Transaction, checkpoint: Transaction): Promise<{
        transaction: Transaction;
        checkpoint: Transaction;
    }>;
    monitorSwap(swapId: string, update: (type: BoltzSwapStatus, data?: any) => void): Promise<void>;
    restoreSwaps(publicKey: string): Promise<CreateSwapsRestoreResponse>;
    private request;
}

interface SwapManagerConfig {
    /** Auto claim/refund swaps (default: true) */
    enableAutoActions?: boolean;
    /** Polling interval in ms (default: 30000) */
    pollInterval?: number;
    /** Initial reconnect delay (default: 1000) */
    reconnectDelayMs?: number;
    /** Max reconnect delay (default: 60000) */
    maxReconnectDelayMs?: number;
    /** Initial poll retry delay (default: 5000) */
    pollRetryDelayMs?: number;
    /** Max poll retry delay (default: 300000) */
    maxPollRetryDelayMs?: number;
    /** Event callbacks for swap lifecycle events (optional, can use on/off methods instead) */
    events?: SwapManagerEvents;
}
interface SwapManagerEvents {
    onSwapUpdate?: (swap: PendingReverseSwap | PendingSubmarineSwap, oldStatus: BoltzSwapStatus) => void;
    onSwapCompleted?: (swap: PendingReverseSwap | PendingSubmarineSwap) => void;
    onSwapFailed?: (swap: PendingReverseSwap | PendingSubmarineSwap, error: Error) => void;
    onActionExecuted?: (swap: PendingReverseSwap | PendingSubmarineSwap, action: "claim" | "refund") => void;
    onWebSocketConnected?: () => void;
    onWebSocketDisconnected?: (error?: Error) => void;
}
type SwapUpdateListener = (swap: PendingReverseSwap | PendingSubmarineSwap, oldStatus: BoltzSwapStatus) => void;
type SwapCompletedListener = (swap: PendingReverseSwap | PendingSubmarineSwap) => void;
type SwapFailedListener = (swap: PendingReverseSwap | PendingSubmarineSwap, error: Error) => void;
type ActionExecutedListener = (swap: PendingReverseSwap | PendingSubmarineSwap, action: "claim" | "refund") => void;
type WebSocketConnectedListener = () => void;
type WebSocketDisconnectedListener = (error?: Error) => void;
type PendingSwap$1 = PendingReverseSwap | PendingSubmarineSwap;
type SwapUpdateCallback = (swap: PendingSwap$1, oldStatus: BoltzSwapStatus) => void;
interface SwapManagerClient {
    start(pendingSwaps: PendingSwap$1[]): Promise<void>;
    stop(): Promise<void>;
    addSwap(swap: PendingSwap$1): Promise<void>;
    removeSwap(swapId: string): Promise<void>;
    getPendingSwaps(): Promise<PendingSwap$1[]>;
    subscribeToSwapUpdates(swapId: string, callback: SwapUpdateCallback): Promise<() => void>;
    waitForSwapCompletion(swapId: string): Promise<{
        txid: string;
    }>;
    isProcessing(swapId: string): Promise<boolean>;
    hasSwap(swapId: string): Promise<boolean>;
    getStats(): Promise<{
        isRunning: boolean;
        monitoredSwaps: number;
        websocketConnected: boolean;
        usePollingFallback: boolean;
        currentReconnectDelay: number;
        currentPollRetryDelay: number;
    }>;
    onSwapUpdate(listener: SwapUpdateListener): Promise<() => void>;
    onSwapCompleted(listener: SwapCompletedListener): Promise<() => void>;
    onSwapFailed(listener: SwapFailedListener): Promise<() => void>;
    onActionExecuted(listener: ActionExecutedListener): Promise<() => void>;
    onWebSocketConnected(listener: WebSocketConnectedListener): Promise<() => void>;
    onWebSocketDisconnected(listener: WebSocketDisconnectedListener): Promise<() => void>;
}
declare class SwapManager implements SwapManagerClient {
    private readonly swapProvider;
    private readonly config;
    private swapUpdateListeners;
    private swapCompletedListeners;
    private swapFailedListeners;
    private actionExecutedListeners;
    private wsConnectedListeners;
    private wsDisconnectedListeners;
    private websocket;
    private monitoredSwaps;
    private initialSwaps;
    private pollTimer;
    private reconnectTimer;
    private isRunning;
    private currentReconnectDelay;
    private currentPollRetryDelay;
    private usePollingFallback;
    private isReconnecting;
    private swapsInProgress;
    private swapSubscriptions;
    private claimCallback;
    private refundCallback;
    private saveSwapCallback;
    constructor(swapProvider: BoltzSwapProvider, config?: SwapManagerConfig);
    /**
     * Set callbacks for claim, refund, and save operations
     * These are called by the manager when autonomous actions are needed
     */
    setCallbacks(callbacks: {
        claim: (swap: PendingReverseSwap) => Promise<void>;
        refund: (swap: PendingSubmarineSwap) => Promise<void>;
        saveSwap: (swap: PendingSwap$1) => Promise<void>;
    }): void;
    /**
     * Add an event listener for swap updates
     * @returns Unsubscribe function
     */
    onSwapUpdate(listener: SwapUpdateListener): Promise<() => void>;
    /**
     * Add an event listener for swap completion
     * @returns Unsubscribe function
     */
    onSwapCompleted(listener: SwapCompletedListener): Promise<() => void>;
    /**
     * Add an event listener for swap failures
     * @returns Unsubscribe function
     */
    onSwapFailed(listener: SwapFailedListener): Promise<() => void>;
    /**
     * Add an event listener for executed actions (claim/refund)
     * @returns Unsubscribe function
     */
    onActionExecuted(listener: ActionExecutedListener): Promise<() => void>;
    /**
     * Add an event listener for WebSocket connection
     * @returns Unsubscribe function
     */
    onWebSocketConnected(listener: WebSocketConnectedListener): Promise<() => void>;
    /**
     * Add an event listener for WebSocket disconnection
     * @returns Unsubscribe function
     */
    onWebSocketDisconnected(listener: WebSocketDisconnectedListener): Promise<() => void>;
    /**
     * Start the swap manager
     * This will:
     * 1. Load pending swaps
     * 2. Connect WebSocket (with fallback to polling)
     * 3. Poll all swaps after connection
     * 4. Resume any actionable swaps
     */
    start(pendingSwaps: PendingSwap$1[]): Promise<void>;
    /**
     * Stop the swap manager
     * Cleanup: close WebSocket, stop all timers
     */
    stop(): Promise<void>;
    /**
     * Add a new swap to monitoring
     */
    addSwap(swap: PendingSwap$1): Promise<void>;
    /**
     * Remove a swap from monitoring
     */
    removeSwap(swapId: string): Promise<void>;
    /**
     * Get all currently monitored swaps
     */
    getPendingSwaps(): Promise<PendingSwap$1[]>;
    /**
     * Subscribe to updates for a specific swap
     * Returns an unsubscribe function
     * Useful for UI components that need to track specific swap progress
     */
    subscribeToSwapUpdates(swapId: string, callback: SwapUpdateCallback): Promise<() => void>;
    /**
     * Wait for a specific swap to complete
     * This blocks until the swap reaches a final status or fails
     * Useful when you want blocking behavior even with SwapManager enabled
     */
    waitForSwapCompletion(swapId: string): Promise<{
        txid: string;
    }>;
    /**
     * Check if a swap is currently being processed
     * Useful for preventing race conditions
     */
    isProcessing(swapId: string): Promise<boolean>;
    /**
     * Check if manager has a specific swap
     */
    hasSwap(swapId: string): Promise<boolean>;
    /**
     * Connect to WebSocket for real-time swap updates
     * Falls back to polling if connection fails
     */
    private connectWebSocket;
    /**
     * Handle WebSocket connection failure
     * Falls back to polling-only mode with exponential backoff
     */
    private handleWebSocketFailure;
    /**
     * Schedule WebSocket reconnection with exponential backoff
     */
    private scheduleReconnect;
    /**
     * Subscribe to a specific swap ID on the WebSocket
     */
    private subscribeToSwap;
    /**
     * Handle incoming WebSocket message
     */
    private handleWebSocketMessage;
    /**
     * Handle status update for a swap
     * This is the core logic that determines what actions to take
     */
    private handleSwapStatusUpdate;
    /**
     * Execute autonomous action based on swap status
     * Uses locking to prevent race conditions with manual operations
     */
    private executeAutonomousAction;
    /**
     * Execute claim action for reverse swap
     */
    private executeClaimAction;
    /**
     * Execute refund action for submarine swap
     */
    private executeRefundAction;
    /**
     * Save swap to storage
     */
    private saveSwap;
    /**
     * Resume actionable swaps on startup
     * This checks all pending swaps and executes actions if needed
     */
    private resumeActionableSwaps;
    /**
     * Start regular polling
     * Polls all swaps at configured interval when WebSocket is active
     */
    private startPolling;
    /**
     * Start polling fallback when WebSocket is unavailable
     * Uses exponential backoff for retry delay
     */
    private startPollingFallback;
    /**
     * Poll all monitored swaps for status updates
     * This is called:
     * 1. After WebSocket connects
     * 2. After WebSocket reconnects
     * 3. Periodically while WebSocket is active
     * 4. As fallback when WebSocket is unavailable
     */
    private pollAllSwaps;
    /**
     * Check if a status is final (no more updates expected)
     */
    private isFinalStatus;
    /**
     * Get current manager statistics (for debugging/monitoring)
     */
    getStats(): Promise<{
        isRunning: boolean;
        monitoredSwaps: number;
        websocketConnected: boolean;
        usePollingFallback: boolean;
        currentReconnectDelay: number;
        currentPollRetryDelay: number;
    }>;
}

type PendingSwap = PendingReverseSwap | PendingSubmarineSwap;
type GetSwapsFilter = {
    id?: string | string[];
    status?: BoltzSwapStatus | BoltzSwapStatus[];
    type?: PendingSwap["type"] | PendingSwap["type"][];
    orderBy?: "createdAt";
    orderDirection?: "asc" | "desc";
};
interface SwapRepository extends AsyncDisposable {
    saveSwap<T extends PendingSwap>(swap: T): Promise<void>;
    deleteSwap(id: string): Promise<void>;
    getAllSwaps<T extends PendingSwap>(filter?: GetSwapsFilter): Promise<T[]>;
    clear(): Promise<void>;
}

interface Vtxo {
    txid: string;
    vout: number;
    sats: number;
    script: string;
    tx: {
        hex: string;
        version: number;
        locktime: number;
    };
}
type Network = NetworkName;
interface CreateLightningInvoiceRequest {
    amount: number;
    description?: string;
}
interface CreateLightningInvoiceResponse {
    amount: number;
    expiry: number;
    invoice: string;
    paymentHash: string;
    pendingSwap: PendingReverseSwap;
    preimage: string;
}
interface SendLightningPaymentRequest {
    invoice: string;
}
interface SendLightningPaymentResponse {
    amount: number;
    preimage: string;
    txid: string;
}
interface PendingReverseSwap {
    id: string;
    type: "reverse";
    createdAt: number;
    preimage: string;
    status: BoltzSwapStatus;
    request: CreateReverseSwapRequest;
    response: CreateReverseSwapResponse;
}
interface PendingSubmarineSwap {
    id: string;
    type: "submarine";
    createdAt: number;
    preimage?: string;
    /** Original preimage hash from Boltz (available for restored swaps) */
    preimageHash?: string;
    refunded?: boolean;
    refundable?: boolean;
    status: BoltzSwapStatus;
    request: CreateSubmarineSwapRequest;
    response: CreateSubmarineSwapResponse;
}
interface ArkadeLightningConfig {
    wallet: IWallet;
    arkProvider?: ArkProvider;
    swapProvider: BoltzSwapProvider;
    indexerProvider?: IndexerProvider;
    feeConfig?: Partial<FeeConfig>;
    timeoutConfig?: Partial<TimeoutConfig>;
    retryConfig?: Partial<RetryConfig>;
    /**
     * Enable background swap monitoring and autonomous actions.
     * - `false` or `undefined`: SwapManager disabled
     * - `true`: SwapManager enabled with default configuration
     * - `SwapManagerConfig` object: SwapManager enabled with custom configuration
     */
    swapManager?: boolean | (SwapManagerConfig & {
        autoStart?: boolean;
    });
    /**
     * Optional swap repository to use for persisting swap data.
     * - `undefined`: fallback to default IndexedDbSwapRepository
     * - `SwapRepository` object: SwapRepository enabled with custom configuration
     */
    swapRepository?: SwapRepository;
}
interface TimeoutConfig {
    swapExpiryBlocks: number;
    invoiceExpirySeconds: number;
    claimDelayBlocks: number;
}
interface FeeConfig {
    maxMinerFeeSats: number;
    maxSwapFeeSats: number;
}
interface RetryConfig {
    maxAttempts: number;
    delayMs: number;
}
interface DecodedInvoice {
    expiry: number;
    amountSats: number;
    description: string;
    paymentHash: string;
}
interface IncomingPaymentSubscription {
    on(event: "pending", listener: () => void): this;
    on(event: "created", listener: () => void): this;
    on(event: "settled", listener: () => void): this;
    on(event: "failed", listener: (error: Error) => void): this;
    unsubscribe(): void;
}
interface LimitsResponse {
    min: number;
    max: number;
}
/**
 * Fee info returned by Boltz.
 * - percentage: value (e.g., 0.01 = 0.01%)
 * - minerFees: values in satoshis
 */
interface FeesResponse {
    submarine: {
        percentage: number;
        minerFees: number;
    };
    reverse: {
        percentage: number;
        minerFees: {
            lockup: number;
            claim: number;
        };
    };
}

interface IArkadeLightning extends AsyncDisposable {
    /**
     * Start the background swap manager
     * This will load all pending swaps and begin monitoring them
     * Automatically called when SwapManager is enabled
     */
    startSwapManager(): Promise<void>;
    /**
     * Stop the background swap manager
     */
    stopSwapManager(): Promise<void>;
    /**
     * Get the SwapManager instance
     * Useful for accessing manager stats or manually controlling swaps
     */
    getSwapManager(): SwapManagerClient | null;
    /**
     * Creates a Lightning invoice.
     * @param args - The arguments for creating a Lightning invoice.
     * @returns The response containing the created Lightning invoice.
     */
    createLightningInvoice(args: CreateLightningInvoiceRequest): Promise<CreateLightningInvoiceResponse>;
    /**
     * Sends a Lightning payment.
     * 1. decode the invoice to get the amount and destination
     * 2. create submarine swap with the decoded invoice
     * 3. send the swap address and expected amount to the wallet to create a transaction
     * 4. wait for the swap settlement and return the preimage and txid
     * @param args - The arguments for sending a Lightning payment.
     * @returns The result of the payment.
     */
    sendLightningPayment(args: SendLightningPaymentRequest): Promise<SendLightningPaymentResponse>;
    /**
     * Creates a submarine swap.
     * @param args - The arguments for creating a submarine swap.
     * @returns The created pending submarine swap.
     */
    createSubmarineSwap(args: SendLightningPaymentRequest): Promise<PendingSubmarineSwap>;
    /**
     * Creates a reverse swap.
     * @param args - The arguments for creating a reverse swap.
     * @returns The created pending reverse swap.
     */
    createReverseSwap(args: CreateLightningInvoiceRequest): Promise<PendingReverseSwap>;
    /**
     * Claims the VHTLC for a pending reverse swap.
     * If the VHTLC is recoverable, it joins a batch to spend the vtxo via commitment transaction.
     * @param pendingSwap - The pending reverse swap to claim the VHTLC.
     */
    claimVHTLC(pendingSwap: PendingReverseSwap): Promise<void>;
    /**
     * Claims the VHTLC for a pending submarine swap (aka refund).
     * If the VHTLC is recoverable, it joins a batch to spend the vtxo via commitment transaction.
     * @param pendingSwap - The pending submarine swap to refund the VHTLC.
     */
    refundVHTLC(pendingSwap: PendingSubmarineSwap): Promise<void>;
    /**
     * Waits for the swap to be confirmed and claims the VHTLC.
     * If SwapManager is enabled, this delegates to the manager for coordinated processing.
     * @param pendingSwap - The pending reverse swap.
     * @returns The transaction ID of the claimed VHTLC.
     */
    waitAndClaim(pendingSwap: PendingReverseSwap): Promise<{
        txid: string;
    }>;
    /**
     * Waits for the swap settlement.
     * @param pendingSwap - The pending submarine swap.
     * @returns The status of the swap settlement.
     */
    waitForSwapSettlement(pendingSwap: PendingSubmarineSwap): Promise<{
        preimage: string;
    }>;
    /**
     * Restore swaps from Boltz API.
     *
     * Note: restored swaps may lack local-only data such as the original
     * Lightning invoice or preimage. They are intended primarily for
     * display/monitoring and are not automatically wired into the SwapManager.
     * Do not call `claimVHTLC` / `refundVHTLC` on them unless you have
     * enriched the objects with the missing fields.
     *
     * @param boltzFees - Optional fees response to use for restoration.
     * @returns An object containing arrays of restored reverse and submarine swaps.
     */
    restoreSwaps(boltzFees?: FeesResponse): Promise<{
        reverseSwaps: PendingReverseSwap[];
        submarineSwaps: PendingSubmarineSwap[];
    }>;
    /**
     * Enrich a restored reverse swap with its preimage.
     * This makes the swap claimable via `claimVHTLC`.
     * Validates that the preimage hash matches the swap's expected preimageHash.
     *
     * @param swap - The restored reverse swap to enrich.
     * @param preimage - The preimage (hex-encoded) for the swap.
     * @returns The enriched swap object (same reference, mutated).
     * @throws Error if the preimage does not match the swap's preimageHash.
     */
    enrichReverseSwapPreimage(swap: PendingReverseSwap, preimage: string): PendingReverseSwap;
    /**
     * Enrich a restored submarine swap with its invoice.
     * This makes the swap refundable via `refundVHTLC`.
     * Validates that the invoice is well-formed and its payment hash can be extracted.
     * If the swap has a preimageHash (from restoration), validates that the invoice's
     * payment hash matches.
     *
     * @param swap - The restored submarine swap to enrich.
     * @param invoice - The Lightning invoice for the swap.
     * @returns The enriched swap object (same reference, mutated).
     * @throws Error if the invoice is invalid, cannot be decoded, or payment hash doesn't match.
     */
    enrichSubmarineSwapInvoice(swap: PendingSubmarineSwap, invoice: string): PendingSubmarineSwap;
    /**
     * Creates a VHTLC script for the swap.
     * works for submarine swaps and reverse swaps
     * it creates a VHTLC script that can be used to claim or refund the swap
     * it validates the receiver, sender and server public keys are x-only
     * it validates the VHTLC script matches the expected lockup address
     * @param param0 - The parameters for creating the VHTLC script.
     * @returns The created VHTLC script.
     */
    createVHTLCScript({ network, preimageHash, receiverPubkey, senderPubkey, serverPubkey, timeoutBlockHeights, }: {
        network: string;
        preimageHash: Uint8Array;
        receiverPubkey: string;
        senderPubkey: string;
        serverPubkey: string;
        timeoutBlockHeights: {
            refund: number;
            unilateralClaim: number;
            unilateralRefund: number;
            unilateralRefundWithoutReceiver: number;
        };
    }): {
        vhtlcScript: VHTLC.Script;
        vhtlcAddress: string;
    };
    /**
     * Retrieves fees for swaps (in sats and percentage).
     * @returns The fees for swaps.
     */
    getFees(): Promise<FeesResponse>;
    /**
     * Retrieves max and min limits for swaps (in sats).
     * @returns The limits for swaps.
     */
    getLimits(): Promise<LimitsResponse>;
    /**
     * Retrieves swap status by ID.
     * @param swapId - The ID of the swap.
     * @returns The status of the swap.
     */
    getSwapStatus(swapId: string): Promise<GetSwapStatusResponse>;
    /**
     * Retrieves all pending submarine swaps from storage.
     * This method filters the pending swaps to return only those with a status of 'invoice.set'.
     * It is useful for checking the status of all pending submarine swaps in the system.
     *
     * @returns PendingSubmarineSwap[]. If no swaps are found, it returns an empty array.
     */
    getPendingSubmarineSwaps(): Promise<PendingSubmarineSwap[]>;
    /**
     * Retrieves all pending reverse swaps from storage.
     * This method filters the pending swaps to return only those with a status of 'swap.created'.
     * It is useful for checking the status of all pending reverse swaps in the system.
     *
     * @returns PendingReverseSwap[]. If no swaps are found, it returns an empty array.
     */
    getPendingReverseSwaps(): Promise<PendingReverseSwap[]>;
    /**
     * Retrieves swap history from storage.
     * @returns Array of all swaps sorted by creation date (newest first). If no swaps are found, it returns an empty array.
     */
    getSwapHistory(): Promise<(PendingReverseSwap | PendingSubmarineSwap)[]>;
    /**
     * Refreshes the status of all pending swaps in the storage provider.
     * This method iterates through all pending reverse and submarine swaps,
     * checks their current status using the swap provider, and updates the storage provider accordingly.
     * It skips swaps that are already in a final status to avoid unnecessary API calls.
     * If no storage provider is set, the method exits early.
     * Errors during status refresh are logged to the console but do not interrupt the process.
     * @returns void
     * Important: a submarine swap with status payment.failedToPay is considered final and won't be refreshed.
     * User should manually retry or delete it if refund fails.
     */
    refreshSwapsStatus(): Promise<void>;
    /**
     * Dispose of resources (stops SwapManager and cleans up)
     * Can be called manually or automatically with `await using` syntax (TypeScript 5.2+)
     */
    dispose(): Promise<void>;
}
declare class ArkadeLightning implements IArkadeLightning {
    readonly wallet: IWallet;
    readonly arkProvider: ArkProvider;
    readonly swapProvider: BoltzSwapProvider;
    readonly indexerProvider: IndexerProvider;
    readonly swapManager: SwapManager | null;
    readonly swapRepository: SwapRepository;
    constructor(config: ArkadeLightningConfig);
    /**
     * Start the background swap manager
     * This will load all pending swaps and begin monitoring them
     * Automatically called when SwapManager is enabled
     */
    startSwapManager(): Promise<void>;
    /**
     * Stop the background swap manager
     */
    stopSwapManager(): Promise<void>;
    /**
     * Get the SwapManager instance
     * Useful for accessing manager stats or manually controlling swaps
     */
    getSwapManager(): SwapManagerClient | null;
    /**
     * Creates a Lightning invoice.
     * @param args - The arguments for creating a Lightning invoice.
     * @returns The response containing the created Lightning invoice.
     */
    createLightningInvoice(args: CreateLightningInvoiceRequest): Promise<CreateLightningInvoiceResponse>;
    /**
     * Sends a Lightning payment.
     * 1. decode the invoice to get the amount and destination
     * 2. create submarine swap with the decoded invoice
     * 3. send the swap address and expected amount to the wallet to create a transaction
     * 4. wait for the swap settlement and return the preimage and txid
     * @param args - The arguments for sending a Lightning payment.
     * @returns The result of the payment.
     */
    sendLightningPayment(args: SendLightningPaymentRequest): Promise<SendLightningPaymentResponse>;
    /**
     * Creates a submarine swap.
     * @param args - The arguments for creating a submarine swap.
     * @returns The created pending submarine swap.
     */
    createSubmarineSwap(args: SendLightningPaymentRequest): Promise<PendingSubmarineSwap>;
    /**
     * Creates a reverse swap.
     * @param args - The arguments for creating a reverse swap.
     * @returns The created pending reverse swap.
     */
    createReverseSwap(args: CreateLightningInvoiceRequest): Promise<PendingReverseSwap>;
    /**
     * Claims the VHTLC for a pending reverse swap.
     * If the VHTLC is recoverable, it joins a batch to spend the vtxo via commitment transaction.
     * @param pendingSwap - The pending reverse swap to claim the VHTLC.
     */
    claimVHTLC(pendingSwap: PendingReverseSwap): Promise<void>;
    /**
     * Claims the VHTLC for a pending submarine swap (aka refund).
     * If the VHTLC is recoverable, it joins a batch to spend the vtxo via commitment transaction.
     * @param pendingSwap - The pending submarine swap to refund the VHTLC.
     */
    refundVHTLC(pendingSwap: PendingSubmarineSwap): Promise<void>;
    /**
     * Joins a batch to spend the vtxo via commitment transaction
     * @param identity - The identity to use for signing the forfeit transaction.
     * @param input - The input vtxo.
     * @param output - The output script.
     * @param isRecoverable
     * @param forfeitPublicKey - The forfeit public key.
     * @returns The commitment transaction ID.
     */
    private joinBatch;
    /**
     * Waits for the swap to be confirmed and claims the VHTLC.
     * If SwapManager is enabled, this delegates to the manager for coordinated processing.
     * @param pendingSwap - The pending reverse swap.
     * @returns The transaction ID of the claimed VHTLC.
     */
    waitAndClaim(pendingSwap: PendingReverseSwap): Promise<{
        txid: string;
    }>;
    /**
     * Waits for the swap settlement.
     * @param pendingSwap - The pending submarine swap.
     * @returns The status of the swap settlement.
     */
    waitForSwapSettlement(pendingSwap: PendingSubmarineSwap): Promise<{
        preimage: string;
    }>;
    /**
     * Restore swaps from Boltz API.
     *
     * Note: restored swaps may lack local-only data such as the original
     * Lightning invoice or preimage. They are intended primarily for
     * display/monitoring and are not automatically wired into the SwapManager.
     * Do not call `claimVHTLC` / `refundVHTLC` on them unless you have
     * enriched the objects with the missing fields.
     *
     * @param boltzFees - Optional fees response to use for restoration.
     * @returns An object containing arrays of restored reverse and submarine swaps.
     */
    restoreSwaps(boltzFees?: FeesResponse): Promise<{
        reverseSwaps: PendingReverseSwap[];
        submarineSwaps: PendingSubmarineSwap[];
    }>;
    /**
     * Enrich a restored reverse swap with its preimage.
     * This makes the swap claimable via `claimVHTLC`.
     * Validates that the preimage hash matches the swap's expected preimageHash.
     *
     * @param swap - The restored reverse swap to enrich.
     * @param preimage - The preimage (hex-encoded) for the swap.
     * @returns The enriched swap object (same reference, mutated).
     * @throws Error if the preimage does not match the swap's preimageHash.
     */
    enrichReverseSwapPreimage(swap: PendingReverseSwap, preimage: string): PendingReverseSwap;
    /**
     * Enrich a restored submarine swap with its invoice.
     * This makes the swap refundable via `refundVHTLC`.
     * Validates that the invoice is well-formed and its payment hash can be extracted.
     * If the swap has a preimageHash (from restoration), validates that the invoice's
     * payment hash matches.
     *
     * @param swap - The restored submarine swap to enrich.
     * @param invoice - The Lightning invoice for the swap.
     * @returns The enriched swap object (same reference, mutated).
     * @throws Error if the invoice is invalid, cannot be decoded, or payment hash doesn't match.
     */
    enrichSubmarineSwapInvoice(swap: PendingSubmarineSwap, invoice: string): PendingSubmarineSwap;
    private claimVHTLCwithOffchainTx;
    private refundVHTLCwithOffchainTx;
    /**
     * Validates the final Ark transaction.
     * checks that all inputs have a signature for the given pubkey
     * and the signature is correct for the given tapscript leaf
     * TODO: This is a simplified check, we should verify the actual signatures
     * @param finalArkTx The final Ark transaction in PSBT format.
     * @param _pubkey The public key of the user.
     * @param _tapLeaves The taproot script leaves.
     * @returns True if the final Ark transaction is valid, false otherwise.
     */
    validFinalArkTx: (finalArkTx: string, _pubkey: Uint8Array, _tapLeaves: TapLeafScript[]) => boolean;
    /**
     * Creates a VHTLC script for the swap.
     * works for submarine swaps and reverse swaps
     * it creates a VHTLC script that can be used to claim or refund the swap
     * it validates the receiver, sender and server public keys are x-only
     * it validates the VHTLC script matches the expected lockup address
     * @param param0 - The parameters for creating the VHTLC script.
     * @returns The created VHTLC script.
     */
    createVHTLCScript({ network, preimageHash, receiverPubkey, senderPubkey, serverPubkey, timeoutBlockHeights, }: {
        network: string;
        preimageHash: Uint8Array;
        receiverPubkey: string;
        senderPubkey: string;
        serverPubkey: string;
        timeoutBlockHeights: {
            refund: number;
            unilateralClaim: number;
            unilateralRefund: number;
            unilateralRefundWithoutReceiver: number;
        };
    }): {
        vhtlcScript: VHTLC.Script;
        vhtlcAddress: string;
    };
    /**
     * Retrieves fees for swaps (in sats and percentage).
     * @returns The fees for swaps.
     */
    getFees(): Promise<FeesResponse>;
    /**
     * Retrieves max and min limits for swaps (in sats).
     * @returns The limits for swaps.
     */
    getLimits(): Promise<LimitsResponse>;
    /**
     * Retrieves swap status by ID.
     * @param swapId - The ID of the swap.
     * @returns The status of the swap.
     */
    getSwapStatus(swapId: string): Promise<GetSwapStatusResponse>;
    /**
     * Retrieves all pending submarine swaps from storage.
     * This method filters the pending swaps to return only those with a status of 'invoice.set'.
     * It is useful for checking the status of all pending submarine swaps in the system.
     *
     * @returns PendingSubmarineSwap[]. If no swaps are found, it returns an empty array.
     */
    getPendingSubmarineSwaps(): Promise<PendingSubmarineSwap[]>;
    /**
     * Retrieves all pending reverse swaps from storage.
     * This method filters the pending swaps to return only those with a status of 'swap.created'.
     * It is useful for checking the status of all pending reverse swaps in the system.
     *
     * @returns PendingReverseSwap[]. If no swaps are found, it returns an empty array.
     */
    getPendingReverseSwaps(): Promise<PendingReverseSwap[]>;
    /**
     * Retrieves swap history from storage.
     * @returns Array of all swaps sorted by creation date (newest first). If no swaps are found, it returns an empty array.
     */
    getSwapHistory(): Promise<(PendingReverseSwap | PendingSubmarineSwap)[]>;
    /**
     * Refreshes the status of all pending swaps in the storage provider.
     * This method iterates through all pending reverse and submarine swaps,
     * checks their current status using the swap provider, and updates the storage provider accordingly.
     * It skips swaps that are already in a final status to avoid unnecessary API calls.
     * If no storage provider is set, the method exits early.
     * Errors during status refresh are logged to the console but do not interrupt the process.
     * @returns void
     * Important: a submarine swap with status payment.failedToPay is considered final and won't be refreshed.
     * User should manually retry or delete it if refund fails.
     */
    refreshSwapsStatus(): Promise<void>;
    /**
     * Dispose of resources (stops SwapManager and cleans up)
     * Can be called manually or automatically with `await using` syntax (TypeScript 5.2+)
     */
    dispose(): Promise<void>;
    /**
     * Symbol.asyncDispose for automatic cleanup with `await using` syntax
     * Example:
     * ```typescript
     * await using arkadeLightning = new ArkadeLightning({ ... });
     * // SwapManager automatically stopped when scope exits
     * ```
     */
    [Symbol.asyncDispose](): Promise<void>;
}

interface ErrorOptions {
    message?: string;
    isClaimable?: boolean;
    isRefundable?: boolean;
    pendingSwap?: PendingReverseSwap | PendingSubmarineSwap;
}
declare class SwapError extends Error {
    isClaimable: boolean;
    isRefundable: boolean;
    pendingSwap?: PendingReverseSwap | PendingSubmarineSwap;
    constructor(options?: ErrorOptions);
}
declare class InvoiceExpiredError extends SwapError {
    constructor(options: ErrorOptions);
}
declare class InvoiceFailedToPayError extends SwapError {
    constructor(options: ErrorOptions);
}
declare class InsufficientFundsError extends SwapError {
    constructor(options?: ErrorOptions);
}
declare class NetworkError extends Error {
    statusCode?: number;
    errorData?: any;
    constructor(message: string, statusCode?: number, errorData?: any);
}
declare class SchemaError extends SwapError {
    constructor(options?: ErrorOptions);
}
declare class SwapExpiredError extends SwapError {
    constructor(options: ErrorOptions);
}
declare class TransactionFailedError extends SwapError {
    constructor(options?: ErrorOptions);
}

/**
 * Decodes a Lightning invoice.
 * @param invoice - The Lightning invoice to decode.
 * @returns The decoded invoice.
 */
declare const decodeInvoice: (invoice: string) => DecodedInvoice;
declare const getInvoiceSatoshis: (invoice: string) => number;
declare const getInvoicePaymentHash: (invoice: string) => string;

declare const verifySignatures: (tx: Transaction$1, inputIndex: number, requiredSigners: string[]) => boolean;

type RequestInitArkLn = RequestEnvelope & {
    type: "INIT_ARKADE_LIGHTNING";
    payload: Omit<ArkadeLightningConfig, "wallet" | "swapRepository" | "swapProvider" | "indexerProvider"> & {
        network: Network;
        arkServerUrl: string;
        swapProvider: {
            baseUrl: string;
        };
    };
};
type ResponseInitArkLn = ResponseEnvelope & {
    type: "ARKADE_LIGHTNING_INITIALIZED";
};
type RequestCreateLightningInvoice = RequestEnvelope & {
    type: "CREATE_LIGHTNING_INVOICE";
    payload: CreateLightningInvoiceRequest;
};
type ResponseCreateLightningInvoice = ResponseEnvelope & {
    type: "LIGHTNING_INVOICE_CREATED";
    payload: CreateLightningInvoiceResponse;
};
type RequestSendLightningPayment = RequestEnvelope & {
    type: "SEND_LIGHTNING_PAYMENT";
    payload: SendLightningPaymentRequest;
};
type ResponseSendLightningPayment = ResponseEnvelope & {
    type: "LIGHTNING_PAYMENT_SENT";
    payload: SendLightningPaymentResponse;
};
type RequestCreateSubmarineSwap = RequestEnvelope & {
    type: "CREATE_SUBMARINE_SWAP";
    payload: SendLightningPaymentRequest;
};
type ResponseCreateSubmarineSwap = ResponseEnvelope & {
    type: "SUBMARINE_SWAP_CREATED";
    payload: PendingSubmarineSwap;
};
type RequestCreateReverseSwap = RequestEnvelope & {
    type: "CREATE_REVERSE_SWAP";
    payload: CreateLightningInvoiceRequest;
};
type ResponseCreateReverseSwap = ResponseEnvelope & {
    type: "REVERSE_SWAP_CREATED";
    payload: PendingReverseSwap;
};
type RequestClaimVhtlc = RequestEnvelope & {
    type: "CLAIM_VHTLC";
    payload: PendingReverseSwap;
};
type ResponseClaimVhtlc = ResponseEnvelope & {
    type: "VHTLC_CLAIMED";
};
type RequestRefundVhtlc = RequestEnvelope & {
    type: "REFUND_VHTLC";
    payload: PendingSubmarineSwap;
};
type ResponseRefundVhtlc = ResponseEnvelope & {
    type: "VHTLC_REFUNDED";
};
type RequestWaitAndClaim = RequestEnvelope & {
    type: "WAIT_AND_CLAIM";
    payload: PendingReverseSwap;
};
type ResponseWaitAndClaim = ResponseEnvelope & {
    type: "WAIT_AND_CLAIMED";
    payload: {
        txid: string;
    };
};
type RequestWaitForSwapSettlement = RequestEnvelope & {
    type: "WAIT_FOR_SWAP_SETTLEMENT";
    payload: PendingSubmarineSwap;
};
type ResponseWaitForSwapSettlement = ResponseEnvelope & {
    type: "SWAP_SETTLED";
    payload: {
        preimage: string;
    };
};
type RequestRestoreSwaps = RequestEnvelope & {
    type: "RESTORE_SWAPS";
    payload?: FeesResponse;
};
type ResponseRestoreSwaps = ResponseEnvelope & {
    type: "SWAPS_RESTORED";
    payload: {
        reverseSwaps: PendingReverseSwap[];
        submarineSwaps: PendingSubmarineSwap[];
    };
};
type RequestEnrichReverseSwapPreimage = RequestEnvelope & {
    type: "ENRICH_REVERSE_SWAP_PREIMAGE";
    payload: {
        swap: PendingReverseSwap;
        preimage: string;
    };
};
type ResponseEnrichReverseSwapPreimage = ResponseEnvelope & {
    type: "REVERSE_SWAP_PREIMAGE_ENRICHED";
    payload: PendingReverseSwap;
};
type RequestEnrichSubmarineSwapInvoice = RequestEnvelope & {
    type: "ENRICH_SUBMARINE_SWAP_INVOICE";
    payload: {
        swap: PendingSubmarineSwap;
        invoice: string;
    };
};
type ResponseEnrichSubmarineSwapInvoice = ResponseEnvelope & {
    type: "SUBMARINE_SWAP_INVOICE_ENRICHED";
    payload: PendingSubmarineSwap;
};
type RequestGetFees = RequestEnvelope & {
    type: "GET_FEES";
};
type ResponseGetFees = ResponseEnvelope & {
    type: "FEES";
    payload: FeesResponse;
};
type RequestGetLimits = RequestEnvelope & {
    type: "GET_LIMITS";
};
type ResponseGetLimits = ResponseEnvelope & {
    type: "LIMITS";
    payload: LimitsResponse;
};
type RequestGetSwapStatus = RequestEnvelope & {
    type: "GET_SWAP_STATUS";
    payload: {
        swapId: string;
    };
};
type ResponseGetSwapStatus = ResponseEnvelope & {
    type: "SWAP_STATUS";
    payload: GetSwapStatusResponse;
};
type RequestGetPendingSubmarineSwaps = RequestEnvelope & {
    type: "GET_PENDING_SUBMARINE_SWAPS";
};
type ResponseGetPendingSubmarineSwaps = ResponseEnvelope & {
    type: "PENDING_SUBMARINE_SWAPS";
    payload: PendingSubmarineSwap[];
};
type RequestGetPendingReverseSwaps = RequestEnvelope & {
    type: "GET_PENDING_REVERSE_SWAPS";
};
type ResponseGetPendingReverseSwaps = ResponseEnvelope & {
    type: "PENDING_REVERSE_SWAPS";
    payload: PendingReverseSwap[];
};
type RequestGetSwapHistory = RequestEnvelope & {
    type: "GET_SWAP_HISTORY";
};
type ResponseGetSwapHistory = ResponseEnvelope & {
    type: "SWAP_HISTORY";
    payload: (PendingReverseSwap | PendingSubmarineSwap)[];
};
type RequestRefreshSwapsStatus = RequestEnvelope & {
    type: "REFRESH_SWAPS_STATUS";
};
type ResponseRefreshSwapsStatus = ResponseEnvelope & {
    type: "SWAPS_STATUS_REFRESHED";
};
type RequestSwapManagerStart = RequestEnvelope & {
    type: "SM-START";
};
type ResponseSwapManagerStart = ResponseEnvelope & {
    type: "SM-STARTED";
};
type RequestSwapManagerStop = RequestEnvelope & {
    type: "SM-STOP";
};
type ResponseSwapManagerStop = ResponseEnvelope & {
    type: "SM-STOPPED";
};
type RequestSwapManagerAddSwap = RequestEnvelope & {
    type: "SM-ADD_SWAP";
    payload: PendingReverseSwap | PendingSubmarineSwap;
};
type ResponseSwapManagerAddSwap = ResponseEnvelope & {
    type: "SM-SWAP_ADDED";
};
type RequestSwapManagerRemoveSwap = RequestEnvelope & {
    type: "SM-REMOVE_SWAP";
    payload: {
        swapId: string;
    };
};
type ResponseSwapManagerRemoveSwap = ResponseEnvelope & {
    type: "SM-SWAP_REMOVED";
};
type RequestSwapManagerGetPending = RequestEnvelope & {
    type: "SM-GET_PENDING_SWAPS";
};
type ResponseSwapManagerGetPending = ResponseEnvelope & {
    type: "SM-PENDING_SWAPS";
    payload: (PendingReverseSwap | PendingSubmarineSwap)[];
};
type RequestSwapManagerHasSwap = RequestEnvelope & {
    type: "SM-HAS_SWAP";
    payload: {
        swapId: string;
    };
};
type ResponseSwapManagerHasSwap = ResponseEnvelope & {
    type: "SM-HAS_SWAP_RESULT";
    payload: {
        has: boolean;
    };
};
type RequestSwapManagerIsProcessing = RequestEnvelope & {
    type: "SM-IS_PROCESSING";
    payload: {
        swapId: string;
    };
};
type ResponseSwapManagerIsProcessing = ResponseEnvelope & {
    type: "SM-IS_PROCESSING_RESULT";
    payload: {
        processing: boolean;
    };
};
type RequestSwapManagerGetStats = RequestEnvelope & {
    type: "SM-GET_STATS";
};
type ResponseSwapManagerGetStats = ResponseEnvelope & {
    type: "SM-STATS";
    payload: {
        isRunning: boolean;
        monitoredSwaps: number;
        websocketConnected: boolean;
        usePollingFallback: boolean;
        currentReconnectDelay: number;
        currentPollRetryDelay: number;
    };
};
type RequestSwapManagerWaitForCompletion = RequestEnvelope & {
    type: "SM-WAIT_FOR_COMPLETION";
    payload: {
        swapId: string;
    };
};
type ResponseSwapManagerWaitForCompletion = ResponseEnvelope & {
    type: "SM-COMPLETED";
    payload: {
        txid: string;
    };
};
type ArkadeLightningUpdaterRequest = RequestInitArkLn | RequestCreateLightningInvoice | RequestSendLightningPayment | RequestCreateSubmarineSwap | RequestCreateReverseSwap | RequestClaimVhtlc | RequestRefundVhtlc | RequestWaitAndClaim | RequestWaitForSwapSettlement | RequestRestoreSwaps | RequestEnrichReverseSwapPreimage | RequestEnrichSubmarineSwapInvoice | RequestGetFees | RequestGetLimits | RequestGetSwapStatus | RequestGetPendingSubmarineSwaps | RequestGetPendingReverseSwaps | RequestGetSwapHistory | RequestRefreshSwapsStatus | RequestSwapManagerStart | RequestSwapManagerStop | RequestSwapManagerAddSwap | RequestSwapManagerRemoveSwap | RequestSwapManagerGetPending | RequestSwapManagerHasSwap | RequestSwapManagerIsProcessing | RequestSwapManagerGetStats | RequestSwapManagerWaitForCompletion;
type ArkadeLightningUpdaterResponse = ResponseInitArkLn | ResponseCreateLightningInvoice | ResponseSendLightningPayment | ResponseCreateSubmarineSwap | ResponseCreateReverseSwap | ResponseClaimVhtlc | ResponseRefundVhtlc | ResponseWaitAndClaim | ResponseWaitForSwapSettlement | ResponseRestoreSwaps | ResponseEnrichReverseSwapPreimage | ResponseEnrichSubmarineSwapInvoice | ResponseGetFees | ResponseGetLimits | ResponseGetSwapStatus | ResponseGetPendingSubmarineSwaps | ResponseGetPendingReverseSwaps | ResponseGetSwapHistory | ResponseRefreshSwapsStatus | ResponseSwapManagerStart | ResponseSwapManagerStop | ResponseSwapManagerAddSwap | ResponseSwapManagerRemoveSwap | ResponseSwapManagerGetPending | ResponseSwapManagerHasSwap | ResponseSwapManagerIsProcessing | ResponseSwapManagerGetStats | ResponseSwapManagerWaitForCompletion;
declare class ArkadeLightningMessageHandler implements MessageHandler<ArkadeLightningUpdaterRequest, ArkadeLightningUpdaterResponse> {
    private readonly swapRepository;
    static messageTag: string;
    readonly messageTag: string;
    private arkProvider;
    private indexerProvider;
    private swapProvider;
    private wallet;
    private handler;
    private swapManager;
    constructor(swapRepository: SwapRepository);
    start(opts: {
        wallet?: IWallet;
        readonlyWallet: IReadonlyWallet;
    }): Promise<void>;
    stop(): Promise<void>;
    tick(_now: number): Promise<never[]>;
    private tagged;
    private broadcastEvent;
    handleMessage(message: ArkadeLightningUpdaterRequest): Promise<ArkadeLightningUpdaterResponse>;
    private handleInit;
}

type SvcWrkArkadeLightningConfig = Pick<ArkadeLightningConfig, "swapManager" | "swapProvider" | "swapRepository"> & {
    serviceWorker: ServiceWorker;
    messageTag?: string;
    network: Network;
    arkServerUrl: string;
};
declare class ServiceWorkerArkadeLightning implements IArkadeLightning {
    private readonly messageTag;
    readonly serviceWorker: ServiceWorker;
    readonly swapRepository: SwapRepository;
    private readonly withSwapManager;
    private eventListenerInitialized;
    private swapUpdateListeners;
    private swapCompletedListeners;
    private swapFailedListeners;
    private actionExecutedListeners;
    private wsConnectedListeners;
    private wsDisconnectedListeners;
    private constructor();
    static create(config: SvcWrkArkadeLightningConfig): Promise<ServiceWorkerArkadeLightning>;
    startSwapManager(): Promise<void>;
    stopSwapManager(): Promise<void>;
    getSwapManager(): SwapManagerClient | null;
    createLightningInvoice(args: CreateLightningInvoiceRequest): Promise<CreateLightningInvoiceResponse>;
    sendLightningPayment(args: SendLightningPaymentRequest): Promise<SendLightningPaymentResponse>;
    createSubmarineSwap(args: SendLightningPaymentRequest): Promise<PendingSubmarineSwap>;
    createReverseSwap(args: CreateLightningInvoiceRequest): Promise<PendingReverseSwap>;
    claimVHTLC(pendingSwap: PendingReverseSwap): Promise<void>;
    refundVHTLC(pendingSwap: PendingSubmarineSwap): Promise<void>;
    waitAndClaim(pendingSwap: PendingReverseSwap): Promise<{
        txid: string;
    }>;
    waitForSwapSettlement(pendingSwap: PendingSubmarineSwap): Promise<{
        preimage: string;
    }>;
    restoreSwaps(boltzFees?: FeesResponse): Promise<{
        reverseSwaps: PendingReverseSwap[];
        submarineSwaps: PendingSubmarineSwap[];
    }>;
    enrichReverseSwapPreimage(_swap: PendingReverseSwap, _preimage: string): PendingReverseSwap;
    enrichSubmarineSwapInvoice(_swap: PendingSubmarineSwap, _invoice: string): PendingSubmarineSwap;
    createVHTLCScript(_args: {
        network: string;
        preimageHash: Uint8Array;
        receiverPubkey: string;
        senderPubkey: string;
        serverPubkey: string;
        timeoutBlockHeights: {
            refund: number;
            unilateralClaim: number;
            unilateralRefund: number;
            unilateralRefundWithoutReceiver: number;
        };
    }): {
        vhtlcScript: VHTLC.Script;
        vhtlcAddress: string;
    };
    getFees(): Promise<FeesResponse>;
    getLimits(): Promise<LimitsResponse>;
    getSwapStatus(swapId: string): Promise<GetSwapStatusResponse>;
    getPendingSubmarineSwaps(): Promise<PendingSubmarineSwap[]>;
    getPendingReverseSwaps(): Promise<PendingReverseSwap[]>;
    getSwapHistory(): Promise<(PendingReverseSwap | PendingSubmarineSwap)[]>;
    refreshSwapsStatus(): Promise<void>;
    dispose(): Promise<void>;
    [Symbol.asyncDispose](): Promise<void>;
    private sendMessage;
    private initEventStream;
    private handleEventMessage;
}

/**
 * Reader and Writer functions for a key-value storage.
 * It mimics the deprecated StorageAdapter interface from @arkade-os/sdk.
 */
type LegacyStorageAccessor = {
    getItem: (key: string) => Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
};
/**
 * Migrates the swaps stored in the old ContractRepository to the new SwapRepository.
 * It accepts a generic reader/writer interface, once it's done it will set a flag
 * in the storage to avoid running it again.
 *
 * @param storageAdapter - The storage adapter to read the swaps from.
 * @param fresh - The new swap repository to save the swaps to.
 *
 * @return true if data was migrated
 */
declare function migrateToSwapRepository(storageAdapter: LegacyStorageAccessor, fresh: SwapRepository): Promise<boolean>;

/**
 * Logger interface for customizing log output
 */
interface Logger {
    log: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}
/**
 * Default logger using console
 */
declare let logger: Logger;
/**
 * Set a custom logger to override the default console logging
 */
declare function setLogger(customLogger: Logger): void;

declare class IndexedDbSwapRepository implements SwapRepository {
    private readonly dbName;
    private db;
    constructor(dbName?: string);
    private getDB;
    saveSwap<T extends PendingSwap>(swap: T): Promise<void>;
    deleteSwap(id: string): Promise<void>;
    getAllSwaps<T extends PendingSwap>(filter?: GetSwapsFilter): Promise<T[]>;
    clear(): Promise<void>;
    private getSwapsByIndexValues;
    private getAllSwapsFromStore;
    private applySwapsFilter;
    private getAllSwapsByCreatedAt;
    private sortIfNeeded;
    [Symbol.asyncDispose](): Promise<void>;
}

export { ArkadeLightning, type ArkadeLightningConfig, ArkadeLightningMessageHandler, BoltzSwapProvider, type BoltzSwapStatus, type CreateLightningInvoiceResponse, type DecodedInvoice, type FeeConfig, type FeesResponse, type IncomingPaymentSubscription, IndexedDbSwapRepository, InsufficientFundsError, InvoiceExpiredError, InvoiceFailedToPayError, type LimitsResponse, type Logger, type Network, NetworkError, type PendingReverseSwap, type PendingSubmarineSwap, type RetryConfig, SchemaError, type SendLightningPaymentRequest, type SendLightningPaymentResponse, ServiceWorkerArkadeLightning, SwapError, SwapExpiredError, SwapManager, type SwapManagerClient, type SwapManagerConfig, type SwapManagerEvents, type TimeoutConfig, TransactionFailedError, type Vtxo, decodeInvoice, getInvoicePaymentHash, getInvoiceSatoshis, isPendingReverseSwap, isPendingSubmarineSwap, isReverseClaimableStatus, isReverseFinalStatus, isSubmarineFinalStatus, isSubmarineRefundableStatus, isSubmarineSwapRefundable, logger, migrateToSwapRepository, setLogger, verifySignatures };
