// src/errors.ts
var SwapError = class extends Error {
  isClaimable;
  isRefundable;
  pendingSwap;
  constructor(options = {}) {
    super(options.message ?? "Error during swap.");
    this.name = "SwapError";
    this.isClaimable = options.isClaimable ?? false;
    this.isRefundable = options.isRefundable ?? false;
    this.pendingSwap = options.pendingSwap;
  }
};
var InvoiceExpiredError = class extends SwapError {
  constructor(options) {
    super({ message: "The invoice has expired.", ...options });
    this.name = "InvoiceExpiredError";
  }
};
var InvoiceFailedToPayError = class extends SwapError {
  constructor(options) {
    super({
      message: "The provider failed to pay the invoice",
      ...options
    });
    this.name = "InvoiceFailedToPayError";
  }
};
var InsufficientFundsError = class extends SwapError {
  constructor(options = {}) {
    super({ message: "Not enough funds available", ...options });
    this.name = "InsufficientFundsError";
  }
};
var NetworkError = class extends Error {
  statusCode;
  errorData;
  constructor(message, statusCode, errorData) {
    super(message);
    this.name = "NetworkError";
    this.statusCode = statusCode;
    this.errorData = errorData;
  }
};
var SchemaError = class extends SwapError {
  constructor(options = {}) {
    super({ message: "Invalid API response", ...options });
    this.name = "SchemaError";
  }
};
var SwapExpiredError = class extends SwapError {
  constructor(options) {
    super({ message: "The swap has expired", ...options });
    this.name = "SwapExpiredError";
  }
};
var TransactionFailedError = class extends SwapError {
  constructor(options = {}) {
    super({ message: "The transaction has failed.", ...options });
    this.name = "TransactionFailedError";
  }
};
var TransactionLockupFailedError = class extends SwapError {
  constructor(options = {}) {
    super({ message: "The transaction lockup has failed.", ...options });
    this.name = "TransactionLockupFailedError";
  }
};
var TransactionRefundedError = class extends SwapError {
  constructor(options = {}) {
    super({ message: "The transaction has been refunded.", ...options });
    this.name = "TransactionRefundedError";
  }
};

// src/arkade-lightning.ts
import {
  ArkAddress,
  Batch,
  buildOffchainTx,
  combineTapscriptSigs,
  CSVMultisigTapscript as CSVMultisigTapscript2,
  getSequence as getSequence2,
  Intent,
  isRecoverable,
  networks,
  VHTLC,
  VtxoScript as VtxoScript2,
  VtxoTaprootTree
} from "@arkade-os/sdk";
import { sha256 as sha2562 } from "@noble/hashes/sha2.js";
import { base64 as base643, hex as hex3 } from "@scure/base";
import { randomBytes } from "@noble/hashes/utils.js";

// src/boltz-swap-provider.ts
import { Transaction } from "@arkade-os/sdk";
import { base64 } from "@scure/base";
var isSubmarineFinalStatus = (status) => {
  return [
    "invoice.failedToPay",
    "transaction.claimed",
    "swap.expired"
  ].includes(status);
};
var isReverseFinalStatus = (status) => {
  return [
    "transaction.refunded",
    "transaction.failed",
    "invoice.settled",
    // normal status for completed swaps
    "swap.expired"
  ].includes(status);
};
var isReverseClaimableStatus = (status) => {
  return ["transaction.mempool", "transaction.confirmed"].includes(status);
};
var isPendingReverseSwap = (swap) => {
  return swap.type === "reverse";
};
var isPendingSubmarineSwap = (swap) => {
  return swap.type === "submarine";
};
var isSubmarineRefundableStatus = (status) => {
  return [
    "invoice.failedToPay",
    "transaction.lockupFailed",
    "swap.expired"
  ].includes(status);
};
var isSubmarineSwapRefundable = (swap) => {
  return isSubmarineRefundableStatus(swap.status) && isPendingSubmarineSwap(swap) && swap.refundable !== false && swap.refunded !== true;
};
var isGetReverseSwapTxIdResponse = (data) => {
  return data && typeof data === "object" && typeof data.id === "string" && typeof data.timeoutBlockHeight === "number";
};
var isGetSwapStatusResponse = (data) => {
  return data && typeof data === "object" && typeof data.status === "string" && (data.zeroConfRejected === void 0 || typeof data.zeroConfRejected === "boolean") && (data.transaction === void 0 || data.transaction && typeof data.transaction === "object" && typeof data.transaction.id === "string" && (data.transaction.eta === void 0 || typeof data.transaction.eta === "number") && (data.transaction.hex === void 0 || typeof data.transaction.hex === "string") && (data.transaction.preimage === void 0 || typeof data.transaction.preimage === "string"));
};
var isGetSubmarinePairsResponse = (data) => {
  return data && typeof data === "object" && data.ARK && typeof data.ARK === "object" && data.ARK.BTC && typeof data.ARK.BTC === "object" && typeof data.ARK.BTC.hash === "string" && typeof data.ARK.BTC.rate === "number" && data.ARK.BTC.limits && typeof data.ARK.BTC.limits === "object" && typeof data.ARK.BTC.limits.maximal === "number" && typeof data.ARK.BTC.limits.minimal === "number" && typeof data.ARK.BTC.limits.maximalZeroConf === "number" && data.ARK.BTC.fees && typeof data.ARK.BTC.fees === "object" && typeof data.ARK.BTC.fees.percentage === "number" && typeof data.ARK.BTC.fees.minerFees === "number";
};
var isGetReversePairsResponse = (data) => {
  return data && typeof data === "object" && data.BTC && typeof data.BTC === "object" && data.BTC.ARK && typeof data.BTC.ARK === "object" && data.BTC.ARK.hash && typeof data.BTC.ARK.hash === "string" && typeof data.BTC.ARK.rate === "number" && data.BTC.ARK.limits && typeof data.BTC.ARK.limits === "object" && typeof data.BTC.ARK.limits.maximal === "number" && typeof data.BTC.ARK.limits.minimal === "number" && data.BTC.ARK.fees && typeof data.BTC.ARK.fees === "object" && typeof data.BTC.ARK.fees.percentage === "number" && typeof data.BTC.ARK.fees.minerFees === "object" && typeof data.BTC.ARK.fees.minerFees.claim === "number" && typeof data.BTC.ARK.fees.minerFees.lockup === "number";
};
var isCreateSubmarineSwapResponse = (data) => {
  return data && typeof data === "object" && typeof data.id === "string" && typeof data.address === "string" && typeof data.expectedAmount === "number" && typeof data.claimPublicKey === "string" && typeof data.acceptZeroConf === "boolean" && data.timeoutBlockHeights && typeof data.timeoutBlockHeights === "object" && typeof data.timeoutBlockHeights.unilateralClaim === "number" && typeof data.timeoutBlockHeights.unilateralRefund === "number" && typeof data.timeoutBlockHeights.unilateralRefundWithoutReceiver === "number";
};
var isGetSwapPreimageResponse = (data) => {
  return data && typeof data === "object" && typeof data.preimage === "string";
};
var isCreateReverseSwapResponse = (data) => {
  return data && typeof data === "object" && typeof data.id === "string" && typeof data.invoice === "string" && typeof data.onchainAmount === "number" && typeof data.lockupAddress === "string" && typeof data.refundPublicKey === "string" && data.timeoutBlockHeights && typeof data.timeoutBlockHeights === "object" && typeof data.timeoutBlockHeights.refund === "number" && typeof data.timeoutBlockHeights.unilateralClaim === "number" && typeof data.timeoutBlockHeights.unilateralRefund === "number" && typeof data.timeoutBlockHeights.unilateralRefundWithoutReceiver === "number";
};
var isRefundSubmarineSwapResponse = (data) => {
  return data && typeof data === "object" && typeof data.transaction === "string" && typeof data.checkpoint === "string";
};
var isLeaf = (data) => {
  return data && typeof data === "object" && typeof data.version === "number" && typeof data.output === "string";
};
var isTree = (data) => {
  return data && typeof data === "object" && isLeaf(data.claimLeaf) && isLeaf(data.refundLeaf) && isLeaf(data.refundWithoutBoltzLeaf) && isLeaf(data.unilateralClaimLeaf) && isLeaf(data.unilateralRefundLeaf) && isLeaf(data.unilateralRefundWithoutBoltzLeaf);
};
var isDetails = (data) => {
  return data && typeof data === "object" && isTree(data.tree) && (data.amount === void 0 || typeof data.amount === "number") && typeof data.keyIndex === "number" && (data.transaction === void 0 || data.transaction && typeof data.transaction === "object" && typeof data.transaction.id === "string" && typeof data.transaction.vout === "number") && typeof data.lockupAddress === "string" && typeof data.serverPublicKey === "string" && typeof data.timeoutBlockHeight === "number" && (data.preimageHash === void 0 || typeof data.preimageHash === "string");
};
var isRestoredSubmarineSwap = (data) => {
  return data && typeof data === "object" && data.to === "BTC" && typeof data.id === "string" && data.from === "ARK" && data.type === "submarine" && typeof data.createdAt === "number" && typeof data.preimageHash === "string" && typeof data.status === "string" && isDetails(data.refundDetails);
};
var isRestoredReverseSwap = (data) => {
  return data && typeof data === "object" && data.to === "ARK" && typeof data.id === "string" && data.from === "BTC" && data.type === "reverse" && typeof data.createdAt === "number" && typeof data.preimageHash === "string" && typeof data.status === "string" && isDetails(data.claimDetails);
};
var isCreateSwapsRestoreResponse = (data) => {
  return Array.isArray(data) && data.every(
    (item) => isRestoredReverseSwap(item) || isRestoredSubmarineSwap(item)
  );
};
var BASE_URLS = {
  mutinynet: "https://api.boltz.mutinynet.arkade.sh",
  regtest: "http://localhost:9069"
};
var BoltzSwapProvider = class {
  wsUrl;
  apiUrl;
  network;
  referralId;
  constructor(config) {
    this.network = config.network;
    const apiUrl = config.apiUrl || BASE_URLS[config.network];
    if (!apiUrl)
      throw new Error(
        `API URL is required for network: ${config.network}`
      );
    this.apiUrl = apiUrl;
    this.wsUrl = this.apiUrl.replace(/^http(s)?:\/\//, "ws$1://").replace("9069", "9004") + "/v2/ws";
  }
  getApiUrl() {
    return this.apiUrl;
  }
  getWsUrl() {
    return this.wsUrl;
  }
  getNetwork() {
    return this.network;
  }
  async getFees() {
    const [submarine, reverse] = await Promise.all([
      this.request(
        "/v2/swap/submarine",
        "GET"
      ),
      this.request("/v2/swap/reverse", "GET")
    ]);
    if (!isGetSubmarinePairsResponse(submarine))
      throw new SchemaError({ message: "error fetching submarine fees" });
    if (!isGetReversePairsResponse(reverse))
      throw new SchemaError({ message: "error fetching reverse fees" });
    return {
      submarine: {
        percentage: submarine.ARK.BTC.fees.percentage,
        minerFees: submarine.ARK.BTC.fees.minerFees
      },
      reverse: {
        percentage: reverse.BTC.ARK.fees.percentage,
        minerFees: reverse.BTC.ARK.fees.minerFees
      }
    };
  }
  async getLimits() {
    const response = await this.request(
      "/v2/swap/submarine",
      "GET"
    );
    if (!isGetSubmarinePairsResponse(response))
      throw new SchemaError({ message: "error fetching limits" });
    return {
      min: response.ARK.BTC.limits.minimal,
      max: response.ARK.BTC.limits.maximal
    };
  }
  async getReverseSwapTxId(id) {
    const res = await this.request(
      `/v2/swap/reverse/${id}/transaction`,
      "GET"
    );
    if (!isGetReverseSwapTxIdResponse(res))
      throw new SchemaError({
        message: `error fetching txid for swap: ${id}`
      });
    return res;
  }
  async getSwapStatus(id) {
    const response = await this.request(
      `/v2/swap/${id}`,
      "GET"
    );
    if (!isGetSwapStatusResponse(response))
      throw new SchemaError({
        message: `error fetching status for swap: ${id}`
      });
    return response;
  }
  async getSwapPreimage(id) {
    const res = await this.request(
      `/v2/swap/submarine/${id}/preimage`,
      "GET"
    );
    if (!isGetSwapPreimageResponse(res))
      throw new SchemaError({
        message: `error fetching preimage for swap: ${id}`
      });
    return res;
  }
  async createSubmarineSwap({
    invoice,
    refundPublicKey
  }) {
    if (refundPublicKey.length != 66) {
      throw new SwapError({
        message: "refundPublicKey must be a compressed public key"
      });
    }
    const requestBody = {
      from: "ARK",
      to: "BTC",
      invoice,
      refundPublicKey,
      ...this.referralId ? { referralId: this.referralId } : {}
    };
    const response = await this.request(
      "/v2/swap/submarine",
      "POST",
      requestBody
    );
    if (!isCreateSubmarineSwapResponse(response))
      throw new SchemaError({ message: "Error creating submarine swap" });
    return response;
  }
  async createReverseSwap({
    invoiceAmount,
    claimPublicKey,
    preimageHash,
    description
  }) {
    if (claimPublicKey.length != 66) {
      throw new SwapError({
        message: "claimPublicKey must be a compressed public key"
      });
    }
    const requestBody = {
      from: "BTC",
      to: "ARK",
      invoiceAmount,
      claimPublicKey,
      preimageHash,
      ...description?.trim() ? { description: description.trim() } : {},
      ...this.referralId ? { referralId: this.referralId } : {}
    };
    const response = await this.request(
      "/v2/swap/reverse",
      "POST",
      requestBody
    );
    if (!isCreateReverseSwapResponse(response))
      throw new SchemaError({ message: "Error creating reverse swap" });
    return response;
  }
  async refundSubmarineSwap(swapId, transaction, checkpoint) {
    const requestBody = {
      checkpoint: base64.encode(checkpoint.toPSBT()),
      transaction: base64.encode(transaction.toPSBT())
    };
    const response = await this.request(
      `/v2/swap/submarine/${swapId}/refund/ark`,
      "POST",
      requestBody
    );
    if (!isRefundSubmarineSwapResponse(response))
      throw new SchemaError({
        message: "Error refunding submarine swap"
      });
    return {
      transaction: Transaction.fromPSBT(
        base64.decode(response.transaction)
      ),
      checkpoint: Transaction.fromPSBT(
        base64.decode(response.checkpoint)
      )
    };
  }
  async monitorSwap(swapId, update) {
    return new Promise((resolve, reject) => {
      const webSocket = new globalThis.WebSocket(this.wsUrl);
      const connectionTimeout = setTimeout(() => {
        webSocket.close();
        reject(new NetworkError("WebSocket connection timeout"));
      }, 3e4);
      webSocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        reject(
          new NetworkError(
            `WebSocket error: ${error.message}`
          )
        );
      };
      webSocket.onopen = () => {
        clearTimeout(connectionTimeout);
        webSocket.send(
          JSON.stringify({
            op: "subscribe",
            channel: "swap.update",
            args: [swapId]
          })
        );
      };
      webSocket.onclose = () => {
        clearTimeout(connectionTimeout);
        resolve();
      };
      webSocket.onmessage = async (rawMsg) => {
        const msg = JSON.parse(rawMsg.data);
        if (msg.event !== "update" || msg.args[0].id !== swapId) return;
        if (msg.args[0].error) {
          webSocket.close();
          reject(new SwapError({ message: msg.args[0].error }));
        }
        const status = msg.args[0].status;
        switch (status) {
          case "invoice.settled":
          case "transaction.claimed":
          case "transaction.refunded":
          case "invoice.expired":
          case "invoice.failedToPay":
          case "transaction.failed":
          case "transaction.lockupFailed":
          case "swap.expired":
            webSocket.close();
            update(status);
            break;
          case "invoice.paid":
          case "invoice.pending":
          case "invoice.set":
          case "swap.created":
          case "transaction.claim.pending":
          case "transaction.confirmed":
          case "transaction.mempool":
            update(status);
        }
      };
    });
  }
  async restoreSwaps(publicKey) {
    const requestBody = {
      publicKey
    };
    const response = await this.request(
      "/v2/swap/restore",
      "POST",
      requestBody
    );
    if (!isCreateSwapsRestoreResponse(response))
      throw new SchemaError({
        message: "Invalid schema in response for swap restoration"
      });
    return response;
  }
  async request(path, method, body) {
    const url = `${this.apiUrl}${path}`;
    try {
      const response = await globalThis.fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : void 0
      });
      if (!response.ok) {
        const errorBody = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorBody);
        } catch {
        }
        const message = `Boltz API error: ${response.status} ${errorBody}`;
        throw new NetworkError(message, response.status, errorData);
      }
      if (response.headers.get("content-length") === "0") {
        throw new NetworkError("Empty response from Boltz API");
      }
      return await response.json();
    } catch (error) {
      if (error instanceof NetworkError) throw error;
      throw new NetworkError(
        `Request to ${url} failed: ${error.message}`
      );
    }
  }
};

// src/arkade-lightning.ts
import { Address, OutScript, Transaction as Transaction4 } from "@scure/btc-signer";
import { ripemd160 } from "@noble/hashes/legacy.js";

// src/utils/decoding.ts
import bolt11 from "light-bolt11-decoder";
var decodeInvoice = (invoice) => {
  const decoded = bolt11.decode(invoice);
  const millisats = Number(
    decoded.sections.find((s) => s.name === "amount")?.value ?? "0"
  );
  return {
    expiry: decoded.expiry ?? 3600,
    amountSats: Math.floor(millisats / 1e3),
    description: decoded.sections.find((s) => s.name === "description")?.value ?? "",
    paymentHash: decoded.sections.find((s) => s.name === "payment_hash")?.value ?? ""
  };
};
var getInvoiceSatoshis = (invoice) => {
  return decodeInvoice(invoice).amountSats;
};
var getInvoicePaymentHash = (invoice) => {
  return decodeInvoice(invoice).paymentHash;
};

// src/utils/signatures.ts
import { verifyTapscriptSignatures } from "@arkade-os/sdk";
var verifySignatures = (tx, inputIndex, requiredSigners) => {
  try {
    verifyTapscriptSignatures(tx, inputIndex, requiredSigners);
    return true;
  } catch (_) {
    return false;
  }
};

// src/utils/restoration.ts
import { hex } from "@scure/base";
import { Script } from "@scure/btc-signer";
import bip68 from "bip68";
function extractTimeLockFromLeafOutput(scriptHex) {
  if (!scriptHex) return 0;
  try {
    const opcodes = Script.decode(hex.decode(scriptHex));
    const hasCLTV = opcodes.findIndex((op) => op === "CHECKLOCKTIMEVERIFY");
    if (hasCLTV > 0) {
      const data = opcodes[hasCLTV - 1];
      if (data instanceof Uint8Array) {
        const dataBytes = new Uint8Array(data).reverse();
        return parseInt(hex.encode(dataBytes), 16);
      }
    }
    const hasCSV = opcodes.findIndex((op) => op === "CHECKSEQUENCEVERIFY");
    if (hasCSV > 0) {
      const data = opcodes[hasCSV - 1];
      if (data instanceof Uint8Array) {
        const dataBytes = new Uint8Array(data).reverse();
        const {
          blocks,
          seconds
        } = bip68.decode(
          parseInt(hex.encode(dataBytes), 16)
        );
        return blocks ?? seconds ?? 0;
      }
    }
  } catch (error) {
    return 0;
  }
  return 0;
}
function extractInvoiceAmount(amountSats, fees) {
  if (!amountSats) return 0;
  const { percentage, minerFees } = fees.reverse;
  const miner = minerFees.lockup + minerFees.claim;
  if (percentage >= 100 || percentage < 0) return 0;
  if (miner >= amountSats) return 0;
  return Math.ceil((amountSats - miner) / (1 - percentage / 100));
}

// src/logger.ts
var logger = console;
function setLogger(customLogger) {
  logger = customLogger;
}

// src/swap-manager.ts
var SwapManager = class {
  swapProvider;
  config;
  // Event listeners storage (supports multiple listeners per event)
  swapUpdateListeners = /* @__PURE__ */ new Set();
  swapCompletedListeners = /* @__PURE__ */ new Set();
  swapFailedListeners = /* @__PURE__ */ new Set();
  actionExecutedListeners = /* @__PURE__ */ new Set();
  wsConnectedListeners = /* @__PURE__ */ new Set();
  wsDisconnectedListeners = /* @__PURE__ */ new Set();
  // State
  websocket = null;
  monitoredSwaps = /* @__PURE__ */ new Map();
  initialSwaps = /* @__PURE__ */ new Map();
  // All swaps passed to start(), including completed ones
  pollTimer = null;
  reconnectTimer = null;
  isRunning = false;
  currentReconnectDelay;
  currentPollRetryDelay;
  usePollingFallback = false;
  isReconnecting = false;
  // Race condition prevention
  swapsInProgress = /* @__PURE__ */ new Set();
  // Per-swap subscriptions for UI hooks
  swapSubscriptions = /* @__PURE__ */ new Map();
  // Callbacks for actions (injected by ArkadeLightning)
  claimCallback = null;
  refundCallback = null;
  saveSwapCallback = null;
  constructor(swapProvider, config = {}) {
    this.swapProvider = swapProvider;
    this.config = {
      enableAutoActions: config.enableAutoActions ?? true,
      pollInterval: config.pollInterval ?? 3e4,
      reconnectDelayMs: config.reconnectDelayMs ?? 1e3,
      maxReconnectDelayMs: config.maxReconnectDelayMs ?? 6e4,
      pollRetryDelayMs: config.pollRetryDelayMs ?? 5e3,
      maxPollRetryDelayMs: config.maxPollRetryDelayMs ?? 3e5,
      events: config.events ?? {}
    };
    if (config.events?.onSwapUpdate) {
      this.swapUpdateListeners.add(config.events.onSwapUpdate);
    }
    if (config.events?.onSwapCompleted) {
      this.swapCompletedListeners.add(config.events.onSwapCompleted);
    }
    if (config.events?.onSwapFailed) {
      this.swapFailedListeners.add(config.events.onSwapFailed);
    }
    if (config.events?.onActionExecuted) {
      this.actionExecutedListeners.add(config.events.onActionExecuted);
    }
    if (config.events?.onWebSocketConnected) {
      this.wsConnectedListeners.add(config.events.onWebSocketConnected);
    }
    if (config.events?.onWebSocketDisconnected) {
      this.wsDisconnectedListeners.add(
        config.events.onWebSocketDisconnected
      );
    }
    this.currentReconnectDelay = this.config.reconnectDelayMs;
    this.currentPollRetryDelay = this.config.pollRetryDelayMs;
  }
  /**
   * Set callbacks for claim, refund, and save operations
   * These are called by the manager when autonomous actions are needed
   */
  setCallbacks(callbacks) {
    this.claimCallback = callbacks.claim;
    this.refundCallback = callbacks.refund;
    this.saveSwapCallback = callbacks.saveSwap;
  }
  /**
   * Add an event listener for swap updates
   * @returns Unsubscribe function
   */
  async onSwapUpdate(listener) {
    this.swapUpdateListeners.add(listener);
    return () => this.swapUpdateListeners.delete(listener);
  }
  /**
   * Add an event listener for swap completion
   * @returns Unsubscribe function
   */
  async onSwapCompleted(listener) {
    this.swapCompletedListeners.add(listener);
    return () => this.swapCompletedListeners.delete(listener);
  }
  /**
   * Add an event listener for swap failures
   * @returns Unsubscribe function
   */
  async onSwapFailed(listener) {
    this.swapFailedListeners.add(listener);
    return () => this.swapFailedListeners.delete(listener);
  }
  /**
   * Add an event listener for executed actions (claim/refund)
   * @returns Unsubscribe function
   */
  async onActionExecuted(listener) {
    this.actionExecutedListeners.add(listener);
    return () => this.actionExecutedListeners.delete(listener);
  }
  /**
   * Add an event listener for WebSocket connection
   * @returns Unsubscribe function
   */
  async onWebSocketConnected(listener) {
    this.wsConnectedListeners.add(listener);
    return () => this.wsConnectedListeners.delete(listener);
  }
  /**
   * Add an event listener for WebSocket disconnection
   * @returns Unsubscribe function
   */
  async onWebSocketDisconnected(listener) {
    this.wsDisconnectedListeners.add(listener);
    return () => this.wsDisconnectedListeners.delete(listener);
  }
  /**
   * Start the swap manager
   * This will:
   * 1. Load pending swaps
   * 2. Connect WebSocket (with fallback to polling)
   * 3. Poll all swaps after connection
   * 4. Resume any actionable swaps
   */
  async start(pendingSwaps) {
    if (this.isRunning) {
      logger.warn("SwapManager is already running");
      return;
    }
    this.isRunning = true;
    this.initialSwaps.clear();
    for (const swap of pendingSwaps) {
      this.initialSwaps.set(swap.id, swap);
    }
    for (const swap of pendingSwaps) {
      if (!this.isFinalStatus(swap.status)) {
        this.monitoredSwaps.set(swap.id, swap);
      }
    }
    logger.log(
      `SwapManager started with ${this.monitoredSwaps.size} pending swaps`
    );
    await this.connectWebSocket();
    await this.resumeActionableSwaps();
  }
  /**
   * Stop the swap manager
   * Cleanup: close WebSocket, stop all timers
   */
  async stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    logger.log("SwapManager stopped");
  }
  /**
   * Add a new swap to monitoring
   */
  async addSwap(swap) {
    this.monitoredSwaps.set(swap.id, swap);
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.subscribeToSwap(swap.id);
    }
    logger.log(`Added swap ${swap.id} to monitoring`);
  }
  /**
   * Remove a swap from monitoring
   */
  async removeSwap(swapId) {
    this.monitoredSwaps.delete(swapId);
    this.swapSubscriptions.delete(swapId);
    logger.log(`Removed swap ${swapId} from monitoring`);
  }
  /**
   * Get all currently monitored swaps
   */
  async getPendingSwaps() {
    return Array.from(this.monitoredSwaps.values());
  }
  /**
   * Subscribe to updates for a specific swap
   * Returns an unsubscribe function
   * Useful for UI components that need to track specific swap progress
   */
  async subscribeToSwapUpdates(swapId, callback) {
    if (!this.swapSubscriptions.has(swapId)) {
      this.swapSubscriptions.set(swapId, /* @__PURE__ */ new Set());
    }
    const subscribers = this.swapSubscriptions.get(swapId);
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        this.swapSubscriptions.delete(swapId);
      }
    };
  }
  /**
   * Wait for a specific swap to complete
   * This blocks until the swap reaches a final status or fails
   * Useful when you want blocking behavior even with SwapManager enabled
   */
  async waitForSwapCompletion(swapId) {
    let swap = this.monitoredSwaps.get(swapId);
    if (!swap) {
      swap = this.initialSwaps.get(swapId);
      if (!swap) {
        throw new Error(`Swap ${swapId} not found in manager`);
      }
    }
    if (this.isFinalStatus(swap.status)) {
      if (isPendingReverseSwap(swap)) {
        const response = await this.swapProvider.getReverseSwapTxId(
          swap.id
        );
        return { txid: response.id };
      }
      throw new Error("Submarine swap already completed");
    }
    return new Promise((resolve, reject) => {
      let unsubscribe = null;
      const handleUpdate = (updatedSwap, _oldStatus) => {
        if (!this.isFinalStatus(updatedSwap.status)) return;
        unsubscribe?.();
        if (isPendingReverseSwap(updatedSwap)) {
          if (updatedSwap.status === "invoice.settled") {
            this.swapProvider.getReverseSwapTxId(updatedSwap.id).then((response) => resolve({ txid: response.id })).catch((error) => reject(error));
          } else {
            reject(
              new Error(
                `Swap failed with status: ${updatedSwap.status}`
              )
            );
          }
        } else if (isPendingSubmarineSwap(updatedSwap)) {
          if (updatedSwap.status === "transaction.claimed") {
            resolve({ txid: updatedSwap.id });
          } else {
            reject(
              new Error(
                `Swap failed with status: ${updatedSwap.status}`
              )
            );
          }
        }
      };
      this.subscribeToSwapUpdates(swapId, handleUpdate).then((unsub) => {
        unsubscribe = unsub;
      }).catch(reject);
    });
  }
  /**
   * Check if a swap is currently being processed
   * Useful for preventing race conditions
   */
  async isProcessing(swapId) {
    return this.swapsInProgress.has(swapId);
  }
  /**
   * Check if manager has a specific swap
   */
  async hasSwap(swapId) {
    return this.monitoredSwaps.has(swapId);
  }
  /**
   * Connect to WebSocket for real-time swap updates
   * Falls back to polling if connection fails
   */
  async connectWebSocket() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    try {
      const wsUrl = this.swapProvider.getWsUrl();
      this.websocket = new globalThis.WebSocket(wsUrl);
      const connectionTimeout = setTimeout(() => {
        logger.error("WebSocket connection timeout");
        this.websocket?.close();
        this.handleWebSocketFailure();
      }, 1e4);
      this.websocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        logger.error("WebSocket error:", error);
        this.handleWebSocketFailure();
      };
      this.websocket.onopen = () => {
        clearTimeout(connectionTimeout);
        logger.log("WebSocket connected");
        this.currentReconnectDelay = this.config.reconnectDelayMs;
        this.usePollingFallback = false;
        this.isReconnecting = false;
        for (const swapId of this.monitoredSwaps.keys()) {
          this.subscribeToSwap(swapId);
        }
        this.pollAllSwaps();
        this.startPolling();
        this.wsConnectedListeners.forEach((listener) => listener());
      };
      this.websocket.onclose = () => {
        clearTimeout(connectionTimeout);
        logger.log("WebSocket disconnected");
        this.websocket = null;
        if (this.isRunning) {
          this.scheduleReconnect();
        }
        this.wsDisconnectedListeners.forEach((listener) => listener());
      };
      this.websocket.onmessage = async (rawMsg) => {
        await this.handleWebSocketMessage(rawMsg);
      };
    } catch (error) {
      logger.error("Failed to create WebSocket:", error);
      this.handleWebSocketFailure();
    }
  }
  /**
   * Handle WebSocket connection failure
   * Falls back to polling-only mode with exponential backoff
   */
  handleWebSocketFailure() {
    this.isReconnecting = false;
    this.websocket = null;
    this.usePollingFallback = true;
    logger.warn(
      "WebSocket unavailable, using polling fallback with increasing interval"
    );
    this.startPollingFallback();
    const error = new NetworkError("WebSocket connection failed");
    this.wsDisconnectedListeners.forEach((listener) => listener(error));
  }
  /**
   * Schedule WebSocket reconnection with exponential backoff
   */
  scheduleReconnect() {
    if (this.reconnectTimer) return;
    logger.log(
      `Scheduling WebSocket reconnect in ${this.currentReconnectDelay}ms`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.isReconnecting = false;
      this.connectWebSocket();
    }, this.currentReconnectDelay);
    this.currentReconnectDelay = Math.min(
      this.currentReconnectDelay * 2,
      this.config.maxReconnectDelayMs
    );
  }
  /**
   * Subscribe to a specific swap ID on the WebSocket
   */
  subscribeToSwap(swapId) {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN)
      return;
    this.websocket.send(
      JSON.stringify({
        op: "subscribe",
        channel: "swap.update",
        args: [swapId]
      })
    );
  }
  /**
   * Handle incoming WebSocket message
   */
  async handleWebSocketMessage(rawMsg) {
    try {
      const msg = JSON.parse(rawMsg.data);
      if (msg.event !== "update") return;
      const swapId = msg.args[0]?.id;
      if (!swapId) return;
      const swap = this.monitoredSwaps.get(swapId);
      if (!swap) return;
      if (msg.args[0].error) {
        logger.error(`Swap ${swapId} error:`, msg.args[0].error);
        const error = new Error(msg.args[0].error);
        this.swapFailedListeners.forEach(
          (listener) => listener(swap, error)
        );
        return;
      }
      const newStatus = msg.args[0].status;
      await this.handleSwapStatusUpdate(swap, newStatus);
    } catch (error) {
      logger.error("Error handling WebSocket message:", error);
    }
  }
  /**
   * Handle status update for a swap
   * This is the core logic that determines what actions to take
   */
  async handleSwapStatusUpdate(swap, newStatus) {
    const oldStatus = swap.status;
    if (oldStatus === newStatus) return;
    swap.status = newStatus;
    logger.log(`Swap ${swap.id} status: ${oldStatus} \u2192 ${newStatus}`);
    this.swapUpdateListeners.forEach(
      (listener) => listener(swap, oldStatus)
    );
    const subscribers = this.swapSubscriptions.get(swap.id);
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(swap, oldStatus);
        } catch (error) {
          logger.error(
            `Error in swap subscription callback for ${swap.id}:`,
            error
          );
        }
      });
    }
    await this.saveSwap(swap);
    if (this.config.enableAutoActions) {
      await this.executeAutonomousAction(swap);
    }
    if (this.isFinalStatus(newStatus)) {
      this.monitoredSwaps.delete(swap.id);
      this.swapSubscriptions.delete(swap.id);
      this.swapCompletedListeners.forEach((listener) => listener(swap));
      logger.log(`Swap ${swap.id} completed with status: ${newStatus}`);
    }
  }
  /**
   * Execute autonomous action based on swap status
   * Uses locking to prevent race conditions with manual operations
   */
  async executeAutonomousAction(swap) {
    if (this.swapsInProgress.has(swap.id)) {
      logger.log(
        `Swap ${swap.id} is already being processed, skipping autonomous action`
      );
      return;
    }
    try {
      this.swapsInProgress.add(swap.id);
      if (isPendingReverseSwap(swap)) {
        if (!swap.preimage || swap.preimage.length === 0) {
          logger.log(
            `Skipping claim for swap ${swap.id}: missing preimage (restored swap)`
          );
          return;
        }
        if (isReverseClaimableStatus(swap.status)) {
          logger.log(`Auto-claiming reverse swap ${swap.id}`);
          await this.executeClaimAction(swap);
          this.actionExecutedListeners.forEach(
            (listener) => listener(swap, "claim")
          );
        }
      } else if (isPendingSubmarineSwap(swap)) {
        if (!swap.request?.invoice || swap.request.invoice.length === 0) {
          logger.log(
            `Skipping refund for swap ${swap.id}: missing invoice (restored swap)`
          );
          return;
        }
        if (isSubmarineRefundableStatus(swap.status)) {
          logger.log(`Auto-refunding submarine swap ${swap.id}`);
          await this.executeRefundAction(swap);
          this.actionExecutedListeners.forEach(
            (listener) => listener(swap, "refund")
          );
        }
      }
    } catch (error) {
      logger.error(
        `Failed to execute autonomous action for swap ${swap.id}:`,
        error
      );
      this.swapFailedListeners.forEach(
        (listener) => listener(swap, error)
      );
    } finally {
      this.swapsInProgress.delete(swap.id);
    }
  }
  /**
   * Execute claim action for reverse swap
   */
  async executeClaimAction(swap) {
    if (!this.claimCallback) {
      logger.error("Claim callback not set");
      return;
    }
    await this.claimCallback(swap);
  }
  /**
   * Execute refund action for submarine swap
   */
  async executeRefundAction(swap) {
    if (!this.refundCallback) {
      logger.error("Refund callback not set");
      return;
    }
    await this.refundCallback(swap);
  }
  /**
   * Save swap to storage
   */
  async saveSwap(swap) {
    if (!this.saveSwapCallback) {
      logger.error("Save swap callback not set");
      return;
    }
    await this.saveSwapCallback(swap);
  }
  /**
   * Resume actionable swaps on startup
   * This checks all pending swaps and executes actions if needed
   */
  async resumeActionableSwaps() {
    if (!this.config.enableAutoActions) {
      return;
    }
    logger.log("Resuming actionable swaps...");
    for (const swap of this.monitoredSwaps.values()) {
      try {
        if (isPendingReverseSwap(swap) && isReverseClaimableStatus(swap.status)) {
          logger.log(`Resuming claim for swap ${swap.id}`);
          await this.executeAutonomousAction(swap);
        } else if (isPendingSubmarineSwap(swap) && isSubmarineRefundableStatus(swap.status)) {
          logger.log(`Resuming refund for swap ${swap.id}`);
          await this.executeAutonomousAction(swap);
        }
      } catch (error) {
        logger.error(`Failed to resume swap ${swap.id}:`, error);
      }
    }
  }
  /**
   * Start regular polling
   * Polls all swaps at configured interval when WebSocket is active
   */
  startPolling() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    this.pollTimer = setTimeout(async () => {
      await this.pollAllSwaps();
      if (this.isRunning) {
        this.startPolling();
      }
    }, this.config.pollInterval);
  }
  /**
   * Start polling fallback when WebSocket is unavailable
   * Uses exponential backoff for retry delay
   */
  startPollingFallback() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    this.pollTimer = setTimeout(async () => {
      await this.pollAllSwaps();
      this.currentPollRetryDelay = Math.min(
        this.currentPollRetryDelay * 2,
        this.config.maxPollRetryDelayMs
      );
      if (this.isRunning && this.usePollingFallback) {
        this.startPollingFallback();
      }
    }, this.currentPollRetryDelay);
    logger.log(`Next polling fallback in ${this.currentPollRetryDelay}ms`);
  }
  /**
   * Poll all monitored swaps for status updates
   * This is called:
   * 1. After WebSocket connects
   * 2. After WebSocket reconnects
   * 3. Periodically while WebSocket is active
   * 4. As fallback when WebSocket is unavailable
   */
  async pollAllSwaps() {
    if (this.monitoredSwaps.size === 0) return;
    logger.log(`Polling ${this.monitoredSwaps.size} swaps...`);
    const pollPromises = Array.from(this.monitoredSwaps.values()).map(
      async (swap) => {
        try {
          const statusResponse = await this.swapProvider.getSwapStatus(swap.id);
          if (statusResponse.status !== swap.status) {
            await this.handleSwapStatusUpdate(
              swap,
              statusResponse.status
            );
          }
        } catch (error) {
          logger.error(`Failed to poll swap ${swap.id}:`, error);
        }
      }
    );
    await Promise.allSettled(pollPromises);
  }
  /**
   * Check if a status is final (no more updates expected)
   */
  isFinalStatus(status) {
    return isReverseFinalStatus(status) || isSubmarineFinalStatus(status);
  }
  /**
   * Get current manager statistics (for debugging/monitoring)
   */
  async getStats() {
    return {
      isRunning: this.isRunning,
      monitoredSwaps: this.monitoredSwaps.size,
      websocketConnected: this.websocket !== null && this.websocket.readyState === WebSocket.OPEN,
      usePollingFallback: this.usePollingFallback,
      currentReconnectDelay: this.currentReconnectDelay,
      currentPollRetryDelay: this.currentPollRetryDelay
    };
  }
};

// src/utils/identity.ts
import {
  ConditionWitness,
  setArkPsbtField,
  Transaction as Transaction2
} from "@arkade-os/sdk";
function claimVHTLCIdentity(identity, preimage) {
  return {
    ...identity,
    sign: async (tx, inputIndexes) => {
      const cpy = tx.clone();
      let signedTx = await identity.sign(cpy, inputIndexes);
      signedTx = Transaction2.fromPSBT(signedTx.toPSBT());
      if (preimage) {
        for (const inputIndex of inputIndexes || Array.from(
          { length: signedTx.inputsLength },
          (_, i) => i
        )) {
          setArkPsbtField(signedTx, inputIndex, ConditionWitness, [
            preimage
          ]);
        }
      }
      return signedTx;
    }
  };
}

// src/batch.ts
import {
  CSVMultisigTapscript,
  Transaction as Transaction3,
  validateVtxoTxGraph,
  validateConnectorsTxGraph,
  VtxoScript,
  buildForfeitTx,
  getSequence
} from "@arkade-os/sdk";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64 as base642, hex as hex2 } from "@scure/base";
import { SigHash } from "@scure/btc-signer";
import { tapLeafHash } from "@scure/btc-signer/payment.js";
function createVHTLCBatchHandler(intentId, vhtlc, arkProvider, identity, session, sweepPublicKey, forfeitOutputScript, connectorIndex = 0) {
  const utf8IntentId = new TextEncoder().encode(intentId);
  const intentIdHash = sha256(utf8IntentId);
  const intentIdHashStr = hex2.encode(intentIdHash);
  let sweepTapTreeRoot;
  return {
    onBatchStarted: async (event) => {
      let skip = true;
      for (const idHash of event.intentIdHashes) {
        if (idHash === intentIdHashStr) {
          if (!arkProvider) {
            throw new Error("Ark provider not configured");
          }
          await arkProvider.confirmRegistration(intentId);
          skip = false;
        }
      }
      if (skip) {
        return { skip };
      }
      const sweepTapscript = CSVMultisigTapscript.encode({
        timelock: {
          value: event.batchExpiry,
          type: event.batchExpiry >= 512n ? "seconds" : "blocks"
        },
        pubkeys: [sweepPublicKey]
      }).script;
      sweepTapTreeRoot = tapLeafHash(sweepTapscript);
      return { skip: false };
    },
    onTreeSigningStarted: async (event, vtxoTree) => {
      if (!session) {
        return { skip: true };
      }
      if (!sweepTapTreeRoot) {
        throw new Error("Sweep tap tree root not set");
      }
      const xOnlyPublicKeys = event.cosignersPublicKeys.map(
        (k) => k.slice(2)
      );
      const signerPublicKey = await session.getPublicKey();
      const xonlySignerPublicKey = signerPublicKey.subarray(1);
      if (!xOnlyPublicKeys.includes(hex2.encode(xonlySignerPublicKey))) {
        return { skip: true };
      }
      const commitmentTx = Transaction3.fromPSBT(
        base642.decode(event.unsignedCommitmentTx)
      );
      validateVtxoTxGraph(vtxoTree, commitmentTx, sweepTapTreeRoot);
      const sharedOutput = commitmentTx.getOutput(0);
      if (!sharedOutput?.amount) {
        throw new Error("Shared output not found");
      }
      await session.init(vtxoTree, sweepTapTreeRoot, sharedOutput.amount);
      const pubkey = hex2.encode(await session.getPublicKey());
      const nonces = await session.getNonces();
      await arkProvider.submitTreeNonces(event.id, pubkey, nonces);
      return { skip: false };
    },
    onTreeNonces: async (event) => {
      if (!session) {
        return { fullySigned: true };
      }
      const { hasAllNonces } = await session.aggregatedNonces(
        event.txid,
        event.nonces
      );
      if (!hasAllNonces) return { fullySigned: false };
      const signatures = await session.sign();
      const pubkey = hex2.encode(await session.getPublicKey());
      await arkProvider.submitTreeSignatures(
        event.id,
        pubkey,
        signatures
      );
      return { fullySigned: true };
    },
    onBatchFinalization: async (event, _, connectorTree) => {
      if (!forfeitOutputScript) {
        return;
      }
      if (!connectorTree) {
        throw new Error(
          "BatchFinalizationEvent: expected connector tree to be defined"
        );
      }
      validateConnectorsTxGraph(event.commitmentTx, connectorTree);
      const connectors = connectorTree.leaves();
      if (connectors.length <= connectorIndex) {
        throw new Error(
          `BatchFinalizationEvent: expected connector tree has ${connectors.length} leaves, expected at least ${connectorIndex + 1}`
        );
      }
      const forfeitTx = createForfeitTx(
        vhtlc,
        forfeitOutputScript,
        connectors[connectorIndex]
      );
      const signedForfeitTx = await identity.sign(forfeitTx);
      await arkProvider.submitSignedForfeitTxs([
        base642.encode(signedForfeitTx.toPSBT())
      ]);
    }
  };
}
function createForfeitTx(input, forfeitOutputScript, connector) {
  const connectorTxId = connector.id;
  const connectorOutput = connector.getOutput(0);
  if (!connectorOutput) {
    throw new Error("connector output not found");
  }
  const connectorAmount = connectorOutput.amount;
  const connectorPkScript = connectorOutput.script;
  if (!connectorAmount || !connectorPkScript) {
    throw new Error("invalid connector output");
  }
  const sequence = getSequence(input.tapLeafScript);
  return buildForfeitTx(
    [
      {
        txid: input.txid,
        index: input.vout,
        witnessUtxo: {
          amount: BigInt(input.value),
          script: VtxoScript.decode(input.tapTree).pkScript
        },
        sighashType: SigHash.DEFAULT,
        tapLeafScript: [input.tapLeafScript],
        sequence
      },
      {
        txid: connectorTxId,
        index: 0,
        witnessUtxo: {
          amount: connectorAmount,
          script: connectorPkScript
        }
      }
    ],
    forfeitOutputScript,
    sequence
  );
}

// src/repositories/IndexedDb/swap-repository.ts
import { closeDatabase, openDatabase } from "@arkade-os/sdk";
var DEFAULT_DB_NAME = "arkade-boltz-swap";
var DB_VERSION = 2;
var STORE_SWAPS_STATE = "swaps";
function initDatabase(db) {
  if (!db.objectStoreNames.contains(STORE_SWAPS_STATE)) {
    const swapStore = db.createObjectStore(STORE_SWAPS_STATE, {
      keyPath: "id"
    });
    swapStore.createIndex("status", "status", { unique: false });
    swapStore.createIndex("type", "type", { unique: false });
    swapStore.createIndex("createdAt", "createdAt", { unique: false });
  }
}
var IndexedDbSwapRepository = class {
  constructor(dbName = DEFAULT_DB_NAME) {
    this.dbName = dbName;
  }
  db = null;
  async getDB() {
    if (this.db) return this.db;
    this.db = await openDatabase(this.dbName, DB_VERSION, initDatabase);
    return this.db;
  }
  async saveSwap(swap) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_SWAPS_STATE],
        "readwrite"
      );
      const store = transaction.objectStore(STORE_SWAPS_STATE);
      const request = store.put(swap);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async deleteSwap(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_SWAPS_STATE],
        "readwrite"
      );
      const store = transaction.objectStore(STORE_SWAPS_STATE);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  async getAllSwaps(filter) {
    return this.getAllSwapsFromStore(filter);
  }
  async clear() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORE_SWAPS_STATE],
        "readwrite"
      );
      const store = transaction.objectStore(STORE_SWAPS_STATE);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  getSwapsByIndexValues(store, indexName, values) {
    if (values.length === 0) return Promise.resolve([]);
    const index = store.index(indexName);
    const requests = values.map(
      (value) => new Promise((resolve, reject) => {
        const request = index.getAll(value);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result ?? []);
      })
    );
    return Promise.all(requests).then(
      (results) => results.flatMap((result) => result)
    );
  }
  async getAllSwapsFromStore(filter) {
    const db = await this.getDB();
    const store = db.transaction([STORE_SWAPS_STATE], "readonly").objectStore(STORE_SWAPS_STATE);
    if (!filter || Object.keys(filter).length === 0) {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(request.error);
      });
    }
    const normalizedFilter = normalizeFilter(filter);
    if (normalizedFilter.has("id")) {
      const ids = normalizedFilter.get("id");
      const swaps = await Promise.all(
        ids.map(
          (id) => new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          })
        )
      );
      return this.sortIfNeeded(
        this.applySwapsFilter(swaps, normalizedFilter),
        filter
      );
    }
    if (normalizedFilter.has("type")) {
      const types = normalizedFilter.get("type");
      const swaps = await this.getSwapsByIndexValues(
        store,
        "type",
        types
      );
      return this.sortIfNeeded(
        this.applySwapsFilter(swaps, normalizedFilter),
        filter
      );
    }
    if (normalizedFilter.has("status")) {
      const ids = normalizedFilter.get("status");
      const swaps = await this.getSwapsByIndexValues(
        store,
        "status",
        ids
      );
      return this.sortIfNeeded(
        this.applySwapsFilter(swaps, normalizedFilter),
        filter
      );
    }
    if (filter.orderBy === "createdAt") {
      return this.getAllSwapsByCreatedAt(store, filter.orderDirection);
    }
    const allSwaps = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
    return this.sortIfNeeded(
      this.applySwapsFilter(allSwaps, normalizedFilter),
      filter
    );
  }
  applySwapsFilter(swaps, filter) {
    return swaps.filter((swap) => {
      if (swap === void 0) return false;
      if (filter.has("id") && !filter.get("id")?.includes(swap.id))
        return false;
      if (filter.has("status") && !filter.get("status")?.includes(swap.status))
        return false;
      if (filter.has("type") && !filter.get("type")?.includes(swap.type))
        return false;
      return true;
    });
  }
  async getAllSwapsByCreatedAt(store, orderDirection) {
    const index = store.index("createdAt");
    const direction = orderDirection === "desc" ? "prev" : "next";
    return new Promise((resolve, reject) => {
      const results = [];
      const request = index.openCursor(null, direction);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        results.push(cursor.value);
        cursor.continue();
      };
    });
  }
  sortIfNeeded(swaps, filter) {
    if (filter?.orderBy !== "createdAt") return swaps;
    const direction = filter.orderDirection === "asc" ? 1 : -1;
    return swaps.slice().sort((a, b) => (a.createdAt - b.createdAt) * direction);
  }
  async [Symbol.asyncDispose]() {
    if (!this.db) return;
    await closeDatabase(this.dbName);
    this.db = null;
  }
};
var FILTER_FIELDS = ["id", "status", "type"];
function normalizeFilter(filter) {
  const res = /* @__PURE__ */ new Map();
  FILTER_FIELDS.forEach((current) => {
    if (!filter?.[current]) return;
    if (Array.isArray(filter[current])) {
      res.set(current, filter[current]);
    } else {
      res.set(current, [filter[current]]);
    }
  });
  return res;
}

// src/utils/keys.ts
function normalizeToXOnlyPublicKey(publicKey, keyName, swapId) {
  if (publicKey.length === 33) {
    return publicKey.slice(1);
  }
  if (publicKey.length !== 32) {
    throw new Error(
      `Invalid ${keyName} public key length: ${publicKey.length} ${swapId ? "for swap " + swapId : ""}`
    );
  }
  return publicKey;
}

// src/arkade-lightning.ts
var ArkadeLightning = class {
  wallet;
  arkProvider;
  swapProvider;
  indexerProvider;
  swapManager = null;
  swapRepository;
  constructor(config) {
    if (!config.wallet) throw new Error("Wallet is required.");
    if (!config.swapProvider) throw new Error("Swap provider is required.");
    this.wallet = config.wallet;
    const arkProvider = config.wallet.arkProvider ?? config.arkProvider;
    if (!arkProvider)
      throw new Error(
        "Ark provider is required either in wallet or config."
      );
    this.arkProvider = arkProvider;
    const indexerProvider = config.wallet.indexerProvider ?? config.indexerProvider;
    if (!indexerProvider)
      throw new Error(
        "Indexer provider is required either in wallet or config."
      );
    this.indexerProvider = indexerProvider;
    this.swapProvider = config.swapProvider;
    if (config.swapRepository) {
      this.swapRepository = config.swapRepository;
    } else {
      this.swapRepository = new IndexedDbSwapRepository();
    }
    if (config.swapManager) {
      const swapManagerConfig = config.swapManager === true ? {} : config.swapManager;
      const shouldAutostart = swapManagerConfig.autoStart ?? true;
      this.swapManager = new SwapManager(
        this.swapProvider,
        swapManagerConfig
      );
      this.swapManager.setCallbacks({
        claim: async (swap) => {
          await this.claimVHTLC(swap);
        },
        refund: async (swap) => {
          await this.refundVHTLC(swap);
        },
        saveSwap: async (swap) => this.swapRepository.saveSwap(swap)
      });
      if (shouldAutostart) {
        this.startSwapManager().catch((error) => {
          logger.error("Failed to autostart SwapManager:", error);
        });
      }
    }
  }
  // SwapManager methods
  /**
   * Start the background swap manager
   * This will load all pending swaps and begin monitoring them
   * Automatically called when SwapManager is enabled
   */
  async startSwapManager() {
    if (!this.swapManager) {
      throw new Error(
        "SwapManager is not enabled. Provide 'swapManager' config in ArkadeLightningConfig."
      );
    }
    const allSwaps = await this.swapRepository.getAllSwaps();
    await this.swapManager.start(allSwaps);
  }
  /**
   * Stop the background swap manager
   */
  async stopSwapManager() {
    if (!this.swapManager) return;
    await this.swapManager.stop();
  }
  /**
   * Get the SwapManager instance
   * Useful for accessing manager stats or manually controlling swaps
   */
  getSwapManager() {
    return this.swapManager;
  }
  // receive from lightning = reverse submarine swap
  //
  // 1. create invoice by creating a reverse swap
  // 2. monitor incoming payment by waiting for the hold invoice to be paid
  // 3. claim the VHTLC by creating a virtual transaction that spends the VHTLC output
  // 4. return the preimage and the swap info
  /**
   * Creates a Lightning invoice.
   * @param args - The arguments for creating a Lightning invoice.
   * @returns The response containing the created Lightning invoice.
   */
  async createLightningInvoice(args) {
    return this.createReverseSwap(args).then((pendingSwap) => {
      const decodedInvoice = decodeInvoice(pendingSwap.response.invoice);
      return {
        amount: pendingSwap.response.onchainAmount,
        expiry: decodedInvoice.expiry,
        invoice: pendingSwap.response.invoice,
        paymentHash: decodedInvoice.paymentHash,
        pendingSwap,
        preimage: pendingSwap.preimage
      };
    });
  }
  /**
   * Sends a Lightning payment.
   * 1. decode the invoice to get the amount and destination
   * 2. create submarine swap with the decoded invoice
   * 3. send the swap address and expected amount to the wallet to create a transaction
   * 4. wait for the swap settlement and return the preimage and txid
   * @param args - The arguments for sending a Lightning payment.
   * @returns The result of the payment.
   */
  async sendLightningPayment(args) {
    const pendingSwap = await this.createSubmarineSwap(args);
    await this.swapRepository.saveSwap(pendingSwap);
    const txid = await this.wallet.sendBitcoin({
      address: pendingSwap.response.address,
      amount: pendingSwap.response.expectedAmount
    });
    try {
      const { preimage } = await this.waitForSwapSettlement(pendingSwap);
      return {
        amount: pendingSwap.response.expectedAmount,
        preimage,
        txid
      };
    } catch (error) {
      if (error.isRefundable) {
        await this.refundVHTLC(pendingSwap);
        const finalStatus = await this.getSwapStatus(pendingSwap.id);
        await this.swapRepository.saveSwap({
          ...pendingSwap,
          status: finalStatus.status
        });
      }
      throw new TransactionFailedError();
    }
  }
  /**
   * Creates a submarine swap.
   * @param args - The arguments for creating a submarine swap.
   * @returns The created pending submarine swap.
   */
  async createSubmarineSwap(args) {
    const refundPublicKey = hex3.encode(
      await this.wallet.identity.compressedPublicKey()
    );
    if (!refundPublicKey)
      throw new SwapError({
        message: "Failed to get refund public key from wallet"
      });
    const invoice = args.invoice;
    if (!invoice) throw new SwapError({ message: "Invoice is required" });
    const swapRequest = {
      invoice,
      refundPublicKey
    };
    const swapResponse = await this.swapProvider.createSubmarineSwap(swapRequest);
    const pendingSwap = {
      id: swapResponse.id,
      type: "submarine",
      createdAt: Math.floor(Date.now() / 1e3),
      request: swapRequest,
      response: swapResponse,
      status: "invoice.set"
    };
    await this.swapRepository.saveSwap(pendingSwap);
    if (this.swapManager) {
      await this.swapManager.addSwap(pendingSwap);
    }
    return pendingSwap;
  }
  /**
   * Creates a reverse swap.
   * @param args - The arguments for creating a reverse swap.
   * @returns The created pending reverse swap.
   */
  async createReverseSwap(args) {
    if (args.amount <= 0)
      throw new SwapError({ message: "Amount must be greater than 0" });
    const claimPublicKey = hex3.encode(
      await this.wallet.identity.compressedPublicKey()
    );
    if (!claimPublicKey)
      throw new SwapError({
        message: "Failed to get claim public key from wallet"
      });
    const preimage = randomBytes(32);
    const preimageHash = hex3.encode(sha2562(preimage));
    if (!preimageHash)
      throw new SwapError({ message: "Failed to get preimage hash" });
    const swapRequest = {
      invoiceAmount: args.amount,
      claimPublicKey,
      preimageHash,
      ...args.description?.trim() ? { description: args.description.trim() } : {}
    };
    const swapResponse = await this.swapProvider.createReverseSwap(swapRequest);
    const pendingSwap = {
      id: swapResponse.id,
      type: "reverse",
      createdAt: Math.floor(Date.now() / 1e3),
      preimage: hex3.encode(preimage),
      request: swapRequest,
      response: swapResponse,
      status: "swap.created"
    };
    await this.swapRepository.saveSwap(pendingSwap);
    if (this.swapManager) {
      await this.swapManager.addSwap(pendingSwap);
    }
    return pendingSwap;
  }
  /**
   * Claims the VHTLC for a pending reverse swap.
   * If the VHTLC is recoverable, it joins a batch to spend the vtxo via commitment transaction.
   * @param pendingSwap - The pending reverse swap to claim the VHTLC.
   */
  async claimVHTLC(pendingSwap) {
    if (!pendingSwap.preimage)
      throw new Error("Preimage is required to claim VHTLC");
    const preimage = hex3.decode(pendingSwap.preimage);
    const aspInfo = await this.arkProvider.getInfo();
    const address = await this.wallet.getAddress();
    const ourXOnlyPublicKey = normalizeToXOnlyPublicKey(
      await this.wallet.identity.xOnlyPublicKey(),
      "our",
      pendingSwap.id
    );
    const boltzXOnlyPublicKey = normalizeToXOnlyPublicKey(
      hex3.decode(pendingSwap.response.refundPublicKey),
      "boltz",
      pendingSwap.id
    );
    const serverXOnlyPublicKey = normalizeToXOnlyPublicKey(
      hex3.decode(aspInfo.signerPubkey),
      "server",
      pendingSwap.id
    );
    const { vhtlcScript, vhtlcAddress } = this.createVHTLCScript({
      network: aspInfo.network,
      preimageHash: sha2562(preimage),
      receiverPubkey: hex3.encode(ourXOnlyPublicKey),
      senderPubkey: hex3.encode(boltzXOnlyPublicKey),
      serverPubkey: hex3.encode(serverXOnlyPublicKey),
      timeoutBlockHeights: pendingSwap.response.timeoutBlockHeights
    });
    if (!vhtlcScript)
      throw new Error("Failed to create VHTLC script for reverse swap");
    if (vhtlcAddress !== pendingSwap.response.lockupAddress)
      throw new Error("Boltz is trying to scam us");
    const { vtxos } = await this.indexerProvider.getVtxos({
      scripts: [hex3.encode(vhtlcScript.pkScript)]
    });
    if (vtxos.length === 0)
      throw new Error("No spendable virtual coins found");
    const vtxo = vtxos[0];
    if (vtxo.isSpent) {
      throw new Error("VHTLC is already spent");
    }
    const input = {
      ...vtxo,
      tapLeafScript: vhtlcScript.claim(),
      tapTree: vhtlcScript.encode()
    };
    const output = {
      amount: BigInt(vtxo.value),
      script: ArkAddress.decode(address).pkScript
    };
    const vhtlcIdentity = claimVHTLCIdentity(
      this.wallet.identity,
      preimage
    );
    var finalStatus;
    if (isRecoverable(vtxo)) {
      await this.joinBatch(vhtlcIdentity, input, output, aspInfo);
      finalStatus = "transaction.claimed";
    } else {
      await this.claimVHTLCwithOffchainTx(
        vhtlcIdentity,
        vhtlcScript,
        serverXOnlyPublicKey,
        input,
        output,
        aspInfo
      );
      finalStatus = (await this.getSwapStatus(pendingSwap.id)).status;
    }
    await this.swapRepository.saveSwap({
      ...pendingSwap,
      status: finalStatus
    });
  }
  /**
   * Claims the VHTLC for a pending submarine swap (aka refund).
   * If the VHTLC is recoverable, it joins a batch to spend the vtxo via commitment transaction.
   * @param pendingSwap - The pending submarine swap to refund the VHTLC.
   */
  async refundVHTLC(pendingSwap) {
    const preimageHash = pendingSwap.request.invoice ? getInvoicePaymentHash(pendingSwap.request.invoice) : pendingSwap.preimageHash;
    if (!preimageHash)
      throw new Error("Preimage hash is required to refund VHTLC");
    const vhtlcPkScript = ArkAddress.decode(
      pendingSwap.response.address
    ).pkScript;
    const { vtxos } = await this.indexerProvider.getVtxos({
      scripts: [hex3.encode(vhtlcPkScript)]
    });
    if (vtxos.length === 0) {
      throw new Error(
        `VHTLC not found for address ${pendingSwap.response.address}`
      );
    }
    const vtxo = vtxos[0];
    if (vtxo.isSpent) {
      throw new Error("VHTLC is already spent");
    }
    const aspInfo = await this.arkProvider.getInfo();
    const address = await this.wallet.getAddress();
    if (!address) throw new Error("Failed to get ark address from wallet");
    const ourXOnlyPublicKey = normalizeToXOnlyPublicKey(
      await this.wallet.identity.xOnlyPublicKey(),
      "our",
      pendingSwap.id
    );
    const serverXOnlyPublicKey = normalizeToXOnlyPublicKey(
      hex3.decode(aspInfo.signerPubkey),
      "server",
      pendingSwap.id
    );
    const boltzXOnlyPublicKey = normalizeToXOnlyPublicKey(
      hex3.decode(pendingSwap.response.claimPublicKey),
      "boltz",
      pendingSwap.id
    );
    const { vhtlcScript } = this.createVHTLCScript({
      network: aspInfo.network,
      preimageHash: hex3.decode(preimageHash),
      receiverPubkey: hex3.encode(boltzXOnlyPublicKey),
      senderPubkey: hex3.encode(ourXOnlyPublicKey),
      serverPubkey: hex3.encode(serverXOnlyPublicKey),
      timeoutBlockHeights: pendingSwap.response.timeoutBlockHeights
    });
    if (!vhtlcScript)
      throw new Error("Failed to create VHTLC script for reverse swap");
    const isRecoverableVtxo = isRecoverable(vtxo);
    const input = {
      ...vtxo,
      tapLeafScript: isRecoverableVtxo ? vhtlcScript.refundWithoutReceiver() : vhtlcScript.refund(),
      tapTree: vhtlcScript.encode()
    };
    const output = {
      amount: BigInt(vtxo.value),
      script: ArkAddress.decode(address).pkScript
    };
    if (isRecoverableVtxo) {
      await this.joinBatch(this.wallet.identity, input, output, aspInfo);
    } else {
      await this.refundVHTLCwithOffchainTx(
        pendingSwap,
        boltzXOnlyPublicKey,
        ourXOnlyPublicKey,
        serverXOnlyPublicKey,
        input,
        output,
        aspInfo
      );
    }
    await this.swapRepository.saveSwap({
      ...pendingSwap,
      refundable: true,
      refunded: true
    });
  }
  /**
   * Joins a batch to spend the vtxo via commitment transaction
   * @param identity - The identity to use for signing the forfeit transaction.
   * @param input - The input vtxo.
   * @param output - The output script.
   * @param isRecoverable
   * @param forfeitPublicKey - The forfeit public key.
   * @returns The commitment transaction ID.
   */
  async joinBatch(identity, input, output, {
    forfeitPubkey,
    forfeitAddress,
    network
  }, isRecoverable2 = true) {
    const signerSession = identity.signerSession();
    const signerPublicKey = await signerSession.getPublicKey();
    const intentMessage = {
      type: "register",
      onchain_output_indexes: [],
      valid_at: 0,
      expire_at: 0,
      cosigners_public_keys: [hex3.encode(signerPublicKey)]
    };
    const deleteMessage = {
      type: "delete",
      expire_at: 0
    };
    const intentInput = {
      txid: hex3.decode(input.txid),
      index: input.vout,
      witnessUtxo: {
        amount: BigInt(input.value),
        script: VtxoScript2.decode(input.tapTree).pkScript
      },
      tapLeafScript: [input.tapLeafScript],
      unknown: [VtxoTaprootTree.encode(input.tapTree)],
      sequence: getSequence2(input.tapLeafScript)
    };
    const registerIntent = Intent.create(
      intentMessage,
      [intentInput],
      [output]
    );
    const deleteIntent = Intent.create(deleteMessage, [intentInput]);
    const [signedRegisterIntent, signedDeleteIntent] = await Promise.all([
      identity.sign(registerIntent),
      identity.sign(deleteIntent)
    ]);
    const abortController = new AbortController();
    const intentId = await this.arkProvider.registerIntent({
      message: intentMessage,
      proof: base643.encode(signedRegisterIntent.toPSBT())
    });
    const decodedAddress = Address(
      network in networks ? networks[network] : networks.bitcoin
    ).decode(forfeitAddress);
    try {
      const handler = createVHTLCBatchHandler(
        intentId,
        input,
        this.arkProvider,
        identity,
        signerSession,
        hex3.decode(forfeitPubkey).slice(1),
        isRecoverable2 ? void 0 : OutScript.encode(decodedAddress)
      );
      const topics = [
        hex3.encode(signerPublicKey),
        `${input.txid}:${input.vout}`
      ];
      const eventStream = this.arkProvider.getEventStream(
        abortController.signal,
        topics
      );
      const commitmentTxid = await Batch.join(eventStream, handler, {
        abortController
      });
      logger.log(
        "Batch joined with commitment transaction:",
        commitmentTxid
      );
      return commitmentTxid;
    } catch (error) {
      abortController.abort();
      logger.error("Failed to join batch:", error);
      try {
        await this.arkProvider.deleteIntent({
          message: deleteMessage,
          proof: base643.encode(signedDeleteIntent.toPSBT())
        });
      } catch (error2) {
        logger.error("Failed to delete intent:", error2);
      }
      throw error;
    }
  }
  /**
   * Waits for the swap to be confirmed and claims the VHTLC.
   * If SwapManager is enabled, this delegates to the manager for coordinated processing.
   * @param pendingSwap - The pending reverse swap.
   * @returns The transaction ID of the claimed VHTLC.
   */
  async waitAndClaim(pendingSwap) {
    if (this.swapManager && await this.swapManager.hasSwap(pendingSwap.id)) {
      return this.swapManager.waitForSwapCompletion(pendingSwap.id);
    }
    return new Promise((resolve, reject) => {
      const onStatusUpdate = async (status) => {
        const saveStatus = (additionalFields) => this.swapRepository.saveSwap({
          ...pendingSwap,
          status,
          ...additionalFields
        });
        switch (status) {
          case "transaction.mempool":
          case "transaction.confirmed":
            await saveStatus();
            this.claimVHTLC(pendingSwap).catch(reject);
            break;
          case "invoice.settled": {
            await saveStatus();
            const swapStatus = await this.swapProvider.getReverseSwapTxId(
              pendingSwap.id
            );
            const txid = swapStatus.id;
            if (!txid || txid.trim() === "") {
              reject(
                new SwapError({
                  message: `Transaction ID not available for settled swap ${pendingSwap.id}.`
                })
              );
              break;
            }
            resolve({ txid });
            break;
          }
          case "invoice.expired":
            await saveStatus();
            reject(
              new InvoiceExpiredError({
                isRefundable: true,
                pendingSwap
              })
            );
            break;
          case "swap.expired":
            await saveStatus();
            reject(
              new SwapExpiredError({
                isRefundable: true,
                pendingSwap
              })
            );
            break;
          case "transaction.failed":
            await saveStatus();
            reject(new TransactionFailedError());
            break;
          case "transaction.refunded":
            await saveStatus();
            reject(new TransactionRefundedError());
            break;
          default:
            await saveStatus();
            break;
        }
      };
      this.swapProvider.monitorSwap(pendingSwap.id, onStatusUpdate);
    });
  }
  /**
   * Waits for the swap settlement.
   * @param pendingSwap - The pending submarine swap.
   * @returns The status of the swap settlement.
   */
  async waitForSwapSettlement(pendingSwap) {
    return new Promise((resolve, reject) => {
      let isResolved = false;
      const onStatusUpdate = async (status) => {
        if (isResolved) return;
        const saveStatus = (additionalFields) => this.swapRepository.saveSwap({
          ...pendingSwap,
          status,
          ...additionalFields
        });
        switch (status) {
          case "swap.expired":
            isResolved = true;
            await saveStatus({ refundable: true });
            reject(
              new SwapExpiredError({
                isRefundable: true,
                pendingSwap
              })
            );
            break;
          case "invoice.failedToPay":
            isResolved = true;
            await saveStatus({ refundable: true });
            reject(
              new InvoiceFailedToPayError({
                isRefundable: true,
                pendingSwap
              })
            );
            break;
          case "transaction.lockupFailed":
            isResolved = true;
            await saveStatus({ refundable: true });
            reject(
              new TransactionLockupFailedError({
                isRefundable: true,
                pendingSwap
              })
            );
            break;
          case "transaction.claimed": {
            isResolved = true;
            const { preimage } = await this.swapProvider.getSwapPreimage(
              pendingSwap.id
            );
            await saveStatus({ preimage });
            resolve({ preimage });
            break;
          }
          default:
            await saveStatus();
            break;
        }
      };
      this.swapProvider.monitorSwap(pendingSwap.id, onStatusUpdate).catch((error) => {
        if (!isResolved) {
          isResolved = true;
          reject(error);
        }
      });
    });
  }
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
  async restoreSwaps(boltzFees) {
    const publicKey = hex3.encode(
      await this.wallet.identity.compressedPublicKey()
    );
    if (!publicKey) throw new Error("Failed to get public key from wallet");
    const fees = boltzFees ?? await this.swapProvider.getFees();
    const reverseSwaps = [];
    const submarineSwaps = [];
    const restoredSwaps = await this.swapProvider.restoreSwaps(publicKey);
    for (const swap of restoredSwaps) {
      const { id, createdAt, status } = swap;
      if (isRestoredReverseSwap(swap)) {
        const {
          amount,
          lockupAddress,
          preimageHash,
          serverPublicKey,
          tree
        } = swap.claimDetails;
        reverseSwaps.push({
          id,
          createdAt,
          request: {
            invoiceAmount: extractInvoiceAmount(amount, fees),
            claimPublicKey: publicKey,
            preimageHash
          },
          response: {
            id,
            invoice: "",
            // TODO check if we can get the invoice from boltz
            onchainAmount: amount,
            lockupAddress,
            refundPublicKey: serverPublicKey,
            timeoutBlockHeights: {
              refund: extractTimeLockFromLeafOutput(
                tree.refundWithoutBoltzLeaf.output
              ),
              unilateralClaim: extractTimeLockFromLeafOutput(
                tree.unilateralClaimLeaf.output
              ),
              unilateralRefund: extractTimeLockFromLeafOutput(
                tree.unilateralRefundLeaf.output
              ),
              unilateralRefundWithoutReceiver: extractTimeLockFromLeafOutput(
                tree.unilateralRefundWithoutBoltzLeaf.output
              )
            }
          },
          status,
          type: "reverse",
          preimage: ""
        });
      } else if (isRestoredSubmarineSwap(swap)) {
        const { amount, lockupAddress, serverPublicKey, tree } = swap.refundDetails;
        let preimage = "";
        try {
          const data = await this.swapProvider.getSwapPreimage(
            swap.id
          );
          preimage = data.preimage;
        } catch (error) {
          logger.warn(
            `Failed to restore preimage for submarine swap ${id}`,
            error
          );
        }
        submarineSwaps.push({
          id,
          type: "submarine",
          createdAt,
          preimage,
          preimageHash: swap.preimageHash,
          status,
          request: {
            invoice: "",
            // TODO check if we can get the invoice from boltz
            refundPublicKey: publicKey
          },
          response: {
            id,
            address: lockupAddress,
            expectedAmount: amount,
            claimPublicKey: serverPublicKey,
            timeoutBlockHeights: {
              refund: extractTimeLockFromLeafOutput(
                tree.refundWithoutBoltzLeaf.output
              ),
              unilateralClaim: extractTimeLockFromLeafOutput(
                tree.unilateralClaimLeaf.output
              ),
              unilateralRefund: extractTimeLockFromLeafOutput(
                tree.unilateralRefundLeaf.output
              ),
              unilateralRefundWithoutReceiver: extractTimeLockFromLeafOutput(
                tree.unilateralRefundWithoutBoltzLeaf.output
              )
            }
          }
        });
      }
    }
    return { reverseSwaps, submarineSwaps };
  }
  // Swap enrichment and validation helpers
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
  enrichReverseSwapPreimage(swap, preimage) {
    const computedHash = hex3.encode(sha2562(hex3.decode(preimage)));
    if (computedHash !== swap.request.preimageHash) {
      throw new Error(
        `Preimage does not match swap: expected hash ${swap.request.preimageHash}, got ${computedHash}`
      );
    }
    swap.preimage = preimage;
    return swap;
  }
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
  enrichSubmarineSwapInvoice(swap, invoice) {
    let paymentHash;
    try {
      const decoded = decodeInvoice(invoice);
      if (!decoded.paymentHash) {
        throw new Error("Invoice missing payment hash");
      }
      paymentHash = decoded.paymentHash;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Invalid Lightning invoice: ${error.message}`);
      }
      throw new Error(`Invalid Lightning invoice format`);
    }
    if (swap.preimageHash && paymentHash !== swap.preimageHash) {
      throw new Error(
        `Invoice payment hash does not match swap: expected ${swap.preimageHash}, got ${paymentHash}`
      );
    }
    swap.request.invoice = invoice;
    return swap;
  }
  async claimVHTLCwithOffchainTx(vhtlcIdentity, vhtlcScript, serverXOnlyPublicKey, input, output, arkInfos) {
    const rawCheckpointTapscript = hex3.decode(arkInfos.checkpointTapscript);
    const serverUnrollScript = CSVMultisigTapscript2.decode(
      rawCheckpointTapscript
    );
    const { arkTx, checkpoints } = buildOffchainTx(
      [input],
      [output],
      serverUnrollScript
    );
    const signedArkTx = await vhtlcIdentity.sign(arkTx);
    const { arkTxid, finalArkTx, signedCheckpointTxs } = await this.arkProvider.submitTx(
      base643.encode(signedArkTx.toPSBT()),
      checkpoints.map((c) => base643.encode(c.toPSBT()))
    );
    if (!this.validFinalArkTx(
      finalArkTx,
      serverXOnlyPublicKey,
      vhtlcScript.leaves
    )) {
      throw new Error("Invalid final Ark transaction");
    }
    const finalCheckpoints = await Promise.all(
      signedCheckpointTxs.map(async (c) => {
        const tx = Transaction4.fromPSBT(base643.decode(c), {
          allowUnknown: true
        });
        const signedCheckpoint = await vhtlcIdentity.sign(tx, [0]);
        return base643.encode(signedCheckpoint.toPSBT());
      })
    );
    await this.arkProvider.finalizeTx(arkTxid, finalCheckpoints);
  }
  async refundVHTLCwithOffchainTx(pendingSwap, boltzXOnlyPublicKey, ourXOnlyPublicKey, serverXOnlyPublicKey, input, output, arkInfos) {
    const rawCheckpointTapscript = hex3.decode(arkInfos.checkpointTapscript);
    const serverUnrollScript = CSVMultisigTapscript2.decode(
      rawCheckpointTapscript
    );
    const { arkTx: unsignedRefundTx, checkpoints: checkpointPtxs } = buildOffchainTx([input], [output], serverUnrollScript);
    if (checkpointPtxs.length !== 1)
      throw new Error(
        `Expected one checkpoint transaction, got ${checkpointPtxs.length}`
      );
    const unsignedCheckpointTx = checkpointPtxs[0];
    const {
      transaction: boltzSignedRefundTx,
      checkpoint: boltzSignedCheckpointTx
    } = await this.swapProvider.refundSubmarineSwap(
      pendingSwap.id,
      unsignedRefundTx,
      unsignedCheckpointTx
    );
    const boltzXOnlyPublicKeyHex = hex3.encode(boltzXOnlyPublicKey);
    if (!verifySignatures(boltzSignedRefundTx, 0, [boltzXOnlyPublicKeyHex])) {
      throw new Error("Invalid Boltz signature in refund transaction");
    }
    if (!verifySignatures(boltzSignedCheckpointTx, 0, [
      boltzXOnlyPublicKeyHex
    ])) {
      throw new Error(
        "Invalid Boltz signature in checkpoint transaction"
      );
    }
    const signedRefundTx = await this.wallet.identity.sign(unsignedRefundTx);
    const signedCheckpointTx = await this.wallet.identity.sign(unsignedCheckpointTx);
    const combinedSignedRefundTx = combineTapscriptSigs(
      boltzSignedRefundTx,
      signedRefundTx
    );
    const combinedSignedCheckpointTx = combineTapscriptSigs(
      boltzSignedCheckpointTx,
      signedCheckpointTx
    );
    const { arkTxid, finalArkTx, signedCheckpointTxs } = await this.arkProvider.submitTx(
      base643.encode(combinedSignedRefundTx.toPSBT()),
      [base643.encode(unsignedCheckpointTx.toPSBT())]
    );
    const tx = Transaction4.fromPSBT(base643.decode(finalArkTx));
    const inputIndex = 0;
    const requiredSigners = [
      hex3.encode(ourXOnlyPublicKey),
      hex3.encode(boltzXOnlyPublicKey),
      hex3.encode(serverXOnlyPublicKey)
    ];
    if (!verifySignatures(tx, inputIndex, requiredSigners)) {
      throw new Error("Invalid refund transaction");
    }
    if (signedCheckpointTxs.length !== 1) {
      throw new Error(
        `Expected one signed checkpoint transaction, got ${signedCheckpointTxs.length}`
      );
    }
    const serverSignedCheckpointTx = Transaction4.fromPSBT(
      base643.decode(signedCheckpointTxs[0])
    );
    const finalCheckpointTx = combineTapscriptSigs(
      combinedSignedCheckpointTx,
      serverSignedCheckpointTx
    );
    await this.arkProvider.finalizeTx(arkTxid, [
      base643.encode(finalCheckpointTx.toPSBT())
    ]);
  }
  // validators
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
  validFinalArkTx = (finalArkTx, _pubkey, _tapLeaves) => {
    const tx = Transaction4.fromPSBT(base643.decode(finalArkTx), {
      allowUnknown: true
    });
    if (!tx) return false;
    const inputs = [];
    for (let i = 0; i < tx.inputsLength; i++) {
      inputs.push(tx.getInput(i));
    }
    return inputs.every((input) => input.witnessUtxo);
  };
  /**
   * Creates a VHTLC script for the swap.
   * works for submarine swaps and reverse swaps
   * it creates a VHTLC script that can be used to claim or refund the swap
   * it validates the receiver, sender and server public keys are x-only
   * it validates the VHTLC script matches the expected lockup address
   * @param param0 - The parameters for creating the VHTLC script.
   * @returns The created VHTLC script.
   */
  createVHTLCScript({
    network,
    preimageHash,
    receiverPubkey,
    senderPubkey,
    serverPubkey,
    timeoutBlockHeights
  }) {
    const receiverXOnlyPublicKey = normalizeToXOnlyPublicKey(
      hex3.decode(receiverPubkey),
      "receiver"
    );
    const senderXOnlyPublicKey = normalizeToXOnlyPublicKey(
      hex3.decode(senderPubkey),
      "sender"
    );
    const serverXOnlyPublicKey = normalizeToXOnlyPublicKey(
      hex3.decode(serverPubkey),
      "server"
    );
    const delayType = (num) => num < 512 ? "blocks" : "seconds";
    const vhtlcScript = new VHTLC.Script({
      preimageHash: ripemd160(preimageHash),
      sender: senderXOnlyPublicKey,
      receiver: receiverXOnlyPublicKey,
      server: serverXOnlyPublicKey,
      refundLocktime: BigInt(timeoutBlockHeights.refund),
      unilateralClaimDelay: {
        type: delayType(timeoutBlockHeights.unilateralClaim),
        value: BigInt(timeoutBlockHeights.unilateralClaim)
      },
      unilateralRefundDelay: {
        type: delayType(timeoutBlockHeights.unilateralRefund),
        value: BigInt(timeoutBlockHeights.unilateralRefund)
      },
      unilateralRefundWithoutReceiverDelay: {
        type: delayType(
          timeoutBlockHeights.unilateralRefundWithoutReceiver
        ),
        value: BigInt(
          timeoutBlockHeights.unilateralRefundWithoutReceiver
        )
      }
    });
    if (!vhtlcScript) throw new Error("Failed to create VHTLC script");
    const hrp = network === "bitcoin" ? "ark" : "tark";
    const vhtlcAddress = vhtlcScript.address(hrp, serverXOnlyPublicKey).encode();
    return { vhtlcScript, vhtlcAddress };
  }
  /**
   * Retrieves fees for swaps (in sats and percentage).
   * @returns The fees for swaps.
   */
  async getFees() {
    return this.swapProvider.getFees();
  }
  /**
   * Retrieves max and min limits for swaps (in sats).
   * @returns The limits for swaps.
   */
  async getLimits() {
    return this.swapProvider.getLimits();
  }
  /**
   * Retrieves swap status by ID.
   * @param swapId - The ID of the swap.
   * @returns The status of the swap.
   */
  async getSwapStatus(swapId) {
    return this.swapProvider.getSwapStatus(swapId);
  }
  /**
   * Retrieves all pending submarine swaps from storage.
   * This method filters the pending swaps to return only those with a status of 'invoice.set'.
   * It is useful for checking the status of all pending submarine swaps in the system.
   *
   * @returns PendingSubmarineSwap[]. If no swaps are found, it returns an empty array.
   */
  async getPendingSubmarineSwaps() {
    const swaps = await this.swapRepository.getAllSwaps({
      status: "invoice.set",
      type: "submarine"
    });
    return swaps.filter(isPendingSubmarineSwap);
  }
  /**
   * Retrieves all pending reverse swaps from storage.
   * This method filters the pending swaps to return only those with a status of 'swap.created'.
   * It is useful for checking the status of all pending reverse swaps in the system.
   *
   * @returns PendingReverseSwap[]. If no swaps are found, it returns an empty array.
   */
  async getPendingReverseSwaps() {
    const swaps = await this.swapRepository.getAllSwaps({
      status: "swap.created",
      type: "reverse"
    });
    return swaps.filter(isPendingReverseSwap);
  }
  /**
   * Retrieves swap history from storage.
   * @returns Array of all swaps sorted by creation date (newest first). If no swaps are found, it returns an empty array.
   */
  async getSwapHistory() {
    return this.swapRepository.getAllSwaps({
      orderBy: "createdAt",
      orderDirection: "desc"
    });
  }
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
  async refreshSwapsStatus() {
    const swaps = await this.swapRepository.getAllSwaps();
    for (const swap of swaps) {
      if (isReverseFinalStatus(swap.status) || isSubmarineFinalStatus(swap.status))
        continue;
      await this.getSwapStatus(swap.id).then(
        ({ status }) => this.swapRepository.saveSwap({ ...swap, status })
      ).catch((error) => {
        logger.error(
          `Failed to refresh swap status for ${swap.id}:`,
          error
        );
      });
    }
  }
  /**
   * Dispose of resources (stops SwapManager and cleans up)
   * Can be called manually or automatically with `await using` syntax (TypeScript 5.2+)
   */
  async dispose() {
    if (this.swapManager) {
      await this.stopSwapManager();
    }
  }
  /**
   * Symbol.asyncDispose for automatic cleanup with `await using` syntax
   * Example:
   * ```typescript
   * await using arkadeLightning = new ArkadeLightning({ ... });
   * // SwapManager automatically stopped when scope exits
   * ```
   */
  async [Symbol.asyncDispose]() {
    await this.dispose();
  }
};

// src/serviceWorker/arkade-lightning-message-handler.ts
import {
  RestArkProvider,
  RestIndexerProvider
} from "@arkade-os/sdk";
var DEFAULT_MESSAGE_TAG = "ARKADE_LIGHTNING_UPDATER";
var ArkadeLightningMessageHandler = class _ArkadeLightningMessageHandler {
  constructor(swapRepository) {
    this.swapRepository = swapRepository;
  }
  static messageTag = DEFAULT_MESSAGE_TAG;
  messageTag = _ArkadeLightningMessageHandler.messageTag;
  arkProvider;
  indexerProvider;
  swapProvider;
  wallet;
  handler;
  swapManager;
  async start(opts) {
    if (!opts.wallet) throw new Error("Wallet is required");
    this.wallet = opts.wallet;
  }
  async stop() {
    const handler = this.handler;
    if (!handler) return;
    const swapManager = this.swapManager ?? handler.getSwapManager();
    if (swapManager) {
      await swapManager.stop();
    }
    if (typeof handler.dispose === "function") {
      await handler.dispose();
    }
    this.swapManager = null;
    this.handler = void 0;
    this.wallet = void 0;
    this.arkProvider = void 0;
    this.indexerProvider = void 0;
    this.swapProvider = void 0;
  }
  async tick(_now) {
    return [];
  }
  tagged(res) {
    return {
      ...res,
      tag: this.messageTag
    };
  }
  async broadcastEvent(event) {
    const sw = self;
    if (!sw?.clients?.matchAll) return;
    const clients = await sw.clients.matchAll();
    for (const client of clients) {
      try {
        client.postMessage(event);
      } catch {
      }
    }
  }
  async handleMessage(message) {
    const id = message.id;
    if (message.type === "INIT_ARKADE_LIGHTNING") {
      try {
        await this.handleInit(message);
        return this.tagged({
          id,
          type: "ARKADE_LIGHTNING_INITIALIZED"
        });
      } catch (error) {
        return this.tagged({ id, error });
      }
    }
    if (!this.handler || !this.wallet) {
      return this.tagged({
        id,
        error: new Error("handler not initialized")
      });
    }
    try {
      switch (message.type) {
        case "CREATE_LIGHTNING_INVOICE": {
          const res = await this.handler.createLightningInvoice(
            message.payload
          );
          return this.tagged({
            id,
            type: "LIGHTNING_INVOICE_CREATED",
            payload: res
          });
        }
        case "SEND_LIGHTNING_PAYMENT": {
          const res = await this.handler.sendLightningPayment(
            message.payload
          );
          return this.tagged({
            id,
            type: "LIGHTNING_PAYMENT_SENT",
            payload: res
          });
        }
        case "CREATE_SUBMARINE_SWAP": {
          const res = await this.handler.createSubmarineSwap(
            message.payload
          );
          return this.tagged({
            id,
            type: "SUBMARINE_SWAP_CREATED",
            payload: res
          });
        }
        case "CREATE_REVERSE_SWAP": {
          const res = await this.handler.createReverseSwap(
            message.payload
          );
          return this.tagged({
            id,
            type: "REVERSE_SWAP_CREATED",
            payload: res
          });
        }
        case "CLAIM_VHTLC":
          await this.handler.claimVHTLC(message.payload);
          return this.tagged({ id, type: "VHTLC_CLAIMED" });
        case "REFUND_VHTLC":
          await this.handler.refundVHTLC(message.payload);
          return this.tagged({ id, type: "VHTLC_REFUNDED" });
        case "WAIT_AND_CLAIM": {
          const res = await this.handler.waitAndClaim(
            message.payload
          );
          return this.tagged({
            id,
            type: "WAIT_AND_CLAIMED",
            payload: res
          });
        }
        case "WAIT_FOR_SWAP_SETTLEMENT": {
          const res = await this.handler.waitForSwapSettlement(
            message.payload
          );
          return this.tagged({
            id,
            type: "SWAP_SETTLED",
            payload: res
          });
        }
        case "RESTORE_SWAPS": {
          const res = await this.handler.restoreSwaps(
            message.payload
          );
          return this.tagged({
            id,
            type: "SWAPS_RESTORED",
            payload: res
          });
        }
        case "ENRICH_REVERSE_SWAP_PREIMAGE": {
          const res = this.handler.enrichReverseSwapPreimage(
            message.payload.swap,
            message.payload.preimage
          );
          return this.tagged({
            id,
            type: "REVERSE_SWAP_PREIMAGE_ENRICHED",
            payload: res
          });
        }
        case "ENRICH_SUBMARINE_SWAP_INVOICE": {
          const res = this.handler.enrichSubmarineSwapInvoice(
            message.payload.swap,
            message.payload.invoice
          );
          return this.tagged({
            id,
            type: "SUBMARINE_SWAP_INVOICE_ENRICHED",
            payload: res
          });
        }
        case "GET_FEES": {
          const res = await this.handler.getFees();
          return this.tagged({ id, type: "FEES", payload: res });
        }
        case "GET_LIMITS": {
          const res = await this.handler.getLimits();
          return this.tagged({ id, type: "LIMITS", payload: res });
        }
        case "GET_SWAP_STATUS": {
          const res = await this.handler.getSwapStatus(
            message.payload.swapId
          );
          return this.tagged({
            id,
            type: "SWAP_STATUS",
            payload: res
          });
        }
        case "GET_PENDING_SUBMARINE_SWAPS": {
          const res = await this.handler.getPendingSubmarineSwaps();
          return this.tagged({
            id,
            type: "PENDING_SUBMARINE_SWAPS",
            payload: res
          });
        }
        case "GET_PENDING_REVERSE_SWAPS": {
          const res = await this.handler.getPendingReverseSwaps();
          return this.tagged({
            id,
            type: "PENDING_REVERSE_SWAPS",
            payload: res
          });
        }
        case "GET_SWAP_HISTORY": {
          const res = await this.handler.getSwapHistory();
          return this.tagged({
            id,
            type: "SWAP_HISTORY",
            payload: res
          });
        }
        case "REFRESH_SWAPS_STATUS":
          await this.handler.refreshSwapsStatus();
          return this.tagged({ id, type: "SWAPS_STATUS_REFRESHED" });
        /* --- SwapManager methods --- */
        case "SM-START": {
          await this.handler.startSwapManager();
          return this.tagged({ id, type: "SM-STARTED" });
        }
        case "SM-STOP": {
          await this.handler.stopSwapManager();
          return this.tagged({ id, type: "SM-STOPPED" });
        }
        case "SM-ADD_SWAP": {
          await this.handler.getSwapManager().addSwap(message.payload);
          return this.tagged({ id, type: "SM-SWAP_ADDED" });
        }
        case "SM-REMOVE_SWAP": {
          await this.handler.getSwapManager().removeSwap(message.payload.swapId);
          return this.tagged({ id, type: "SM-SWAP_REMOVED" });
        }
        case "SM-GET_PENDING_SWAPS": {
          const res = await this.handler.getSwapManager().getPendingSwaps();
          return this.tagged({
            id,
            type: "SM-PENDING_SWAPS",
            payload: res
          });
        }
        case "SM-HAS_SWAP": {
          const has = await this.handler.getSwapManager().hasSwap(message.payload.swapId);
          return this.tagged({
            id,
            type: "SM-HAS_SWAP_RESULT",
            payload: { has }
          });
        }
        case "SM-IS_PROCESSING": {
          const processing = await this.handler.getSwapManager().isProcessing(message.payload.swapId);
          return this.tagged({
            id,
            type: "SM-IS_PROCESSING_RESULT",
            payload: { processing }
          });
        }
        case "SM-GET_STATS": {
          const stats = await this.handler.getSwapManager().getStats();
          return this.tagged({
            id,
            type: "SM-STATS",
            payload: stats
          });
        }
        case "SM-WAIT_FOR_COMPLETION": {
          const res = await this.handler.getSwapManager().waitForSwapCompletion(message.payload.swapId);
          return this.tagged({
            id,
            type: "SM-COMPLETED",
            payload: res
          });
        }
        default:
          console.error("Unknown message type", message);
          throw new Error("Unknown message");
      }
    } catch (error) {
      return this.tagged({ id, error });
    }
  }
  async handleInit({ payload }) {
    if (!this.wallet) {
      throw new Error("Wallet is required");
    }
    const { arkServerUrl } = payload;
    this.arkProvider = new RestArkProvider(arkServerUrl);
    this.indexerProvider = new RestIndexerProvider(arkServerUrl);
    this.swapProvider = new BoltzSwapProvider({
      apiUrl: payload.swapProvider.baseUrl,
      network: payload.network
    });
    const handler = new ArkadeLightning({
      wallet: this.wallet,
      arkProvider: this.arkProvider,
      swapProvider: this.swapProvider,
      indexerProvider: this.indexerProvider,
      swapRepository: this.swapRepository,
      swapManager: payload.swapManager,
      feeConfig: payload.feeConfig,
      timeoutConfig: payload.timeoutConfig,
      retryConfig: payload.retryConfig
    });
    this.handler = handler;
    const sm = handler.getSwapManager();
    this.swapManager = sm;
    if (sm) {
      void sm.onSwapUpdate(async (swap, oldStatus) => {
        await this.broadcastEvent({
          tag: this.messageTag,
          type: "SM-EVENT-SWAP_UPDATE",
          payload: { swap, oldStatus }
        });
      });
      void sm.onSwapCompleted(async (swap) => {
        await this.broadcastEvent({
          tag: this.messageTag,
          type: "SM-EVENT-SWAP_COMPLETED",
          payload: { swap }
        });
      });
      void sm.onSwapFailed(async (swap, error) => {
        await this.broadcastEvent({
          tag: this.messageTag,
          type: "SM-EVENT-SWAP_FAILED",
          payload: { swap, error: { message: error.message } }
        });
      });
      void sm.onActionExecuted(async (swap, action) => {
        await this.broadcastEvent({
          tag: this.messageTag,
          type: "SM-EVENT-ACTION_EXECUTED",
          payload: { swap, action }
        });
      });
      void sm.onWebSocketConnected(async () => {
        await this.broadcastEvent({
          tag: this.messageTag,
          type: "SM-EVENT-WS_CONNECTED"
        });
      });
      void sm.onWebSocketDisconnected(async (error) => {
        await this.broadcastEvent({
          tag: this.messageTag,
          type: "SM-EVENT-WS_DISCONNECTED",
          payload: error ? { errorMessage: error.message } : void 0
        });
      });
    }
  }
};

// src/serviceWorker/arkade-lightning-runtime.ts
var ServiceWorkerArkadeLightning = class _ServiceWorkerArkadeLightning {
  constructor(messageTag, serviceWorker, swapRepository, withSwapManager) {
    this.messageTag = messageTag;
    this.serviceWorker = serviceWorker;
    this.swapRepository = swapRepository;
    this.withSwapManager = withSwapManager;
  }
  eventListenerInitialized = false;
  swapUpdateListeners = /* @__PURE__ */ new Set();
  swapCompletedListeners = /* @__PURE__ */ new Set();
  swapFailedListeners = /* @__PURE__ */ new Set();
  actionExecutedListeners = /* @__PURE__ */ new Set();
  wsConnectedListeners = /* @__PURE__ */ new Set();
  wsDisconnectedListeners = /* @__PURE__ */ new Set();
  static async create(config) {
    const messageTag = config.messageTag ?? DEFAULT_MESSAGE_TAG;
    const swapRepository = config.swapRepository ?? new IndexedDbSwapRepository();
    const svcArkadeLightning = new _ServiceWorkerArkadeLightning(
      messageTag,
      config.serviceWorker,
      swapRepository,
      Boolean(config.swapManager)
    );
    const initMessage = {
      tag: messageTag,
      id: getRandomId(),
      type: "INIT_ARKADE_LIGHTNING",
      payload: {
        network: config.network,
        arkServerUrl: config.arkServerUrl,
        swapProvider: { baseUrl: config.swapProvider.getApiUrl() },
        swapManager: config.swapManager
      }
    };
    await svcArkadeLightning.sendMessage(initMessage);
    return svcArkadeLightning;
  }
  async startSwapManager() {
    if (!this.withSwapManager) {
      throw new Error("SwapManager is not enabled.");
    }
    await this.sendMessage({
      id: getRandomId(),
      tag: this.messageTag,
      type: "SM-START"
    });
  }
  async stopSwapManager() {
    if (!this.withSwapManager) return;
    await this.sendMessage({
      id: getRandomId(),
      tag: this.messageTag,
      type: "SM-STOP"
    });
  }
  getSwapManager() {
    if (!this.withSwapManager) {
      return null;
    }
    this.initEventStream();
    const send = this.sendMessage.bind(this);
    const tag = this.messageTag;
    const proxy = {
      start: async () => {
        await send({
          id: getRandomId(),
          tag,
          type: "SM-START"
        });
      },
      stop: async () => {
        await send({
          id: getRandomId(),
          tag,
          type: "SM-STOP"
        });
      },
      addSwap: async (swap) => {
        await send({
          id: getRandomId(),
          tag,
          type: "SM-ADD_SWAP",
          payload: swap
        });
      },
      removeSwap: async (swapId) => {
        await send({
          id: getRandomId(),
          tag,
          type: "SM-REMOVE_SWAP",
          payload: { swapId }
        });
      },
      getPendingSwaps: async () => {
        const res = await send({
          id: getRandomId(),
          tag,
          type: "SM-GET_PENDING_SWAPS"
        });
        return res.payload;
      },
      hasSwap: async (swapId) => {
        const res = await send({
          id: getRandomId(),
          tag,
          type: "SM-HAS_SWAP",
          payload: { swapId }
        });
        return res.payload.has;
      },
      isProcessing: async (swapId) => {
        const res = await send({
          id: getRandomId(),
          tag,
          type: "SM-IS_PROCESSING",
          payload: { swapId }
        });
        return res.payload.processing;
      },
      getStats: async () => {
        const res = await send({
          id: getRandomId(),
          tag,
          type: "SM-GET_STATS"
        });
        return res.payload;
      },
      waitForSwapCompletion: async (swapId) => {
        const res = await send({
          id: getRandomId(),
          tag,
          type: "SM-WAIT_FOR_COMPLETION",
          payload: { swapId }
        });
        return res.payload;
      },
      subscribeToSwapUpdates: async (swapId, callback) => {
        const filteredListener = (swap, oldStatus) => {
          if (swap.id === swapId) {
            callback(swap, oldStatus);
          }
        };
        this.swapUpdateListeners.add(filteredListener);
        return () => this.swapUpdateListeners.delete(filteredListener);
      },
      onSwapUpdate: async (listener) => {
        this.swapUpdateListeners.add(listener);
        return () => this.swapUpdateListeners.delete(listener);
      },
      onSwapCompleted: async (listener) => {
        this.swapCompletedListeners.add(listener);
        return () => this.swapCompletedListeners.delete(listener);
      },
      onSwapFailed: async (listener) => {
        this.swapFailedListeners.add(listener);
        return () => this.swapFailedListeners.delete(listener);
      },
      onActionExecuted: async (listener) => {
        this.actionExecutedListeners.add(listener);
        return () => this.actionExecutedListeners.delete(listener);
      },
      onWebSocketConnected: async (listener) => {
        this.wsConnectedListeners.add(listener);
        return () => this.wsConnectedListeners.delete(listener);
      },
      onWebSocketDisconnected: async (listener) => {
        this.wsDisconnectedListeners.add(listener);
        return () => this.wsDisconnectedListeners.delete(listener);
      }
    };
    return proxy;
  }
  async createLightningInvoice(args) {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "CREATE_LIGHTNING_INVOICE",
        payload: args
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot create Lightning Invoice", { cause: e });
    }
  }
  async sendLightningPayment(args) {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "SEND_LIGHTNING_PAYMENT",
        payload: args
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot send Lightning payment", { cause: e });
    }
  }
  async createSubmarineSwap(args) {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "CREATE_SUBMARINE_SWAP",
        payload: args
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot create submarine swap", { cause: e });
    }
  }
  async createReverseSwap(args) {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "CREATE_REVERSE_SWAP",
        payload: args
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot create reverse swap", { cause: e });
    }
  }
  async claimVHTLC(pendingSwap) {
    await this.sendMessage({
      id: getRandomId(),
      tag: this.messageTag,
      type: "CLAIM_VHTLC",
      payload: pendingSwap
    });
  }
  async refundVHTLC(pendingSwap) {
    await this.sendMessage({
      id: getRandomId(),
      tag: this.messageTag,
      type: "REFUND_VHTLC",
      payload: pendingSwap
    });
  }
  async waitAndClaim(pendingSwap) {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "WAIT_AND_CLAIM",
        payload: pendingSwap
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot wait and claim reverse swap", {
        cause: e
      });
    }
  }
  async waitForSwapSettlement(pendingSwap) {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "WAIT_FOR_SWAP_SETTLEMENT",
        payload: pendingSwap
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot wait for swap settlement", { cause: e });
    }
  }
  async restoreSwaps(boltzFees) {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "RESTORE_SWAPS",
        payload: boltzFees
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot restore swaps", { cause: e });
    }
  }
  enrichReverseSwapPreimage(_swap, _preimage) {
    throw new Error(
      "enrichReverseSwapPreimage is not supported via service worker"
    );
  }
  enrichSubmarineSwapInvoice(_swap, _invoice) {
    throw new Error(
      "enrichSubmarineSwapInvoice is not supported via service worker"
    );
  }
  createVHTLCScript(_args) {
    throw new Error(
      "createVHTLCScript is not supported via service worker"
    );
  }
  async getFees() {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "GET_FEES"
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot get fees", { cause: e });
    }
  }
  async getLimits() {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "GET_LIMITS"
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot get limits", { cause: e });
    }
  }
  async getSwapStatus(swapId) {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "GET_SWAP_STATUS",
        payload: { swapId }
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot get swap status", { cause: e });
    }
  }
  async getPendingSubmarineSwaps() {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "GET_PENDING_SUBMARINE_SWAPS"
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot get pending submarine swaps", {
        cause: e
      });
    }
  }
  async getPendingReverseSwaps() {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "GET_PENDING_REVERSE_SWAPS"
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot get pending reverse swaps", { cause: e });
    }
  }
  async getSwapHistory() {
    try {
      const res = await this.sendMessage({
        id: getRandomId(),
        tag: this.messageTag,
        type: "GET_SWAP_HISTORY"
      });
      return res.payload;
    } catch (e) {
      throw new Error("Cannot get swap history", { cause: e });
    }
  }
  async refreshSwapsStatus() {
    await this.sendMessage({
      id: getRandomId(),
      tag: this.messageTag,
      type: "REFRESH_SWAPS_STATUS"
    });
  }
  async dispose() {
    if (this.withSwapManager) {
      await this.stopSwapManager().catch(() => {
      });
    }
  }
  async [Symbol.asyncDispose]() {
    return this.dispose();
  }
  async sendMessage(request) {
    return new Promise((resolve, reject) => {
      const messageHandler = (event) => {
        const response = event.data;
        if (request.id !== response.id) {
          return;
        }
        navigator.serviceWorker.removeEventListener(
          "message",
          messageHandler
        );
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      };
      navigator.serviceWorker.addEventListener("message", messageHandler);
      this.serviceWorker.postMessage(request);
    });
  }
  initEventStream() {
    if (this.eventListenerInitialized) return;
    this.eventListenerInitialized = true;
    navigator.serviceWorker.addEventListener(
      "message",
      this.handleEventMessage
    );
  }
  handleEventMessage = (event) => {
    const data = event.data;
    if (!data || data.tag !== this.messageTag) return;
    if (typeof data.type !== "string") return;
    if (!data.type.startsWith("SM-EVENT-")) return;
    switch (data.type) {
      case "SM-EVENT-SWAP_UPDATE":
        this.swapUpdateListeners.forEach((cb) => {
          cb(data.payload.swap, data.payload.oldStatus);
        });
        break;
      case "SM-EVENT-SWAP_COMPLETED":
        this.swapCompletedListeners.forEach((cb) => {
          cb(data.payload.swap);
        });
        break;
      case "SM-EVENT-SWAP_FAILED": {
        const err = new Error(data.payload.error?.message);
        this.swapFailedListeners.forEach((cb) => {
          cb(data.payload.swap, err);
        });
        break;
      }
      case "SM-EVENT-ACTION_EXECUTED":
        this.actionExecutedListeners.forEach((cb) => {
          cb(data.payload.swap, data.payload.action);
        });
        break;
      case "SM-EVENT-WS_CONNECTED":
        this.wsConnectedListeners.forEach((cb) => {
          cb();
        });
        break;
      case "SM-EVENT-WS_DISCONNECTED": {
        const err = data.payload?.errorMessage ? new Error(data.payload.errorMessage) : void 0;
        this.wsDisconnectedListeners.forEach((cb) => {
          cb(err);
        });
        break;
      }
      default:
        break;
    }
  };
};
function getRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// src/repositories/migrationFromContracts.ts
var MIGRATION_KEY = "migration-from-storage-adapter-swaps";
async function migrateToSwapRepository(storageAdapter, fresh) {
  try {
    const migration = await storageAdapter.getItem(MIGRATION_KEY);
    if (migration === "done") {
      return false;
    }
    const reverseSwaps = await getContractCollection(storageAdapter, "reverseSwaps");
    const submarineSwaps = await getContractCollection(storageAdapter, "submarineSwaps");
    for (const swap of reverseSwaps) {
      await fresh.saveSwap(swap);
    }
    for (const swap of submarineSwaps) {
      await fresh.saveSwap(swap);
    }
    await storageAdapter.setItem(MIGRATION_KEY, "done");
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes(
      "One of the specified object stores was not found."
    )) {
      return false;
    }
    throw error;
  }
}
async function getContractCollection(storage, contractType) {
  const stored = await storage.getItem(`collection:${contractType}`);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (error) {
    const errMessage = "message" in error ? error.message : "";
    throw new Error(
      `Failed to parse contract collection ${contractType} from storage: ${errMessage}`
    );
  }
}
export {
  ArkadeLightning,
  ArkadeLightningMessageHandler,
  BoltzSwapProvider,
  IndexedDbSwapRepository,
  InsufficientFundsError,
  InvoiceExpiredError,
  InvoiceFailedToPayError,
  NetworkError,
  SchemaError,
  ServiceWorkerArkadeLightning,
  SwapError,
  SwapExpiredError,
  SwapManager,
  TransactionFailedError,
  decodeInvoice,
  getInvoicePaymentHash,
  getInvoiceSatoshis,
  isPendingReverseSwap,
  isPendingSubmarineSwap,
  isReverseClaimableStatus,
  isReverseFinalStatus,
  isSubmarineFinalStatus,
  isSubmarineRefundableStatus,
  isSubmarineSwapRefundable,
  logger,
  migrateToSwapRepository,
  setLogger,
  verifySignatures
};
