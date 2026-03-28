/**
 * @title WrapperStructure
 * @dev Data structures for the Asset Wrapper Contract
 */
import {
  AssetType,
  WrappedTokenInfo,
  AssetWrappedEvent,
  AssetUnwrappedEvent,
  CollateralDepositedEvent,
  CollateralWithdrawnEvent,
} from "../interfaces/IAssetWrapper";

export {
  WrappedTokenInfo,
  AssetWrappedEvent,
  AssetUnwrappedEvent,
  CollateralDepositedEvent,
  CollateralWithdrawnEvent,
} from "../interfaces/IAssetWrapper";

export interface SupportedAsset {
  address: string;
  assetType: AssetType;
  isActive: boolean;
  wrapFee: number; // in basis points (100 = 1%)
  unwrapFee: number; // in basis points
  minCollateralRatio: number; // in basis points (15000 = 150%)
  priceFeed: string;
  addedAt: number;
  addedBy: string;
}

export interface UserPosition {
  user: string;
  wrappedTokenId: string;
  wrappedAmount: number;
  collateralDeposited: number;
  lastActivity: number;
}

export interface CollateralInfo {
  wrappedTokenId: string;
  totalDeposited: number;
  totalBorrowed: number;
  availableAmount: number;
  lastUpdated: number;
}

export interface PriceFeed {
  assetAddress: string;
  price: number;
  timestamp: number;
  confidence: number;
  source: string;
}

export interface FeeStructure {
  assetType: AssetType;
  wrapFee: number;
  unwrapFee: number;
  protocolFee: number;
  lastUpdated: number;
  updatedBy: string;
}

export interface WrapperConfig {
  admin: string;
  paused: boolean;
  minCollateralRatio: number;
  liquidationThreshold: number;
  protocolFeeRecipient: string;
  emergencyMode: boolean;
  maxWrapAmount: number;
  maxUnwrapAmount: number;
}

export interface AssetVerificationResult {
  isValid: boolean;
  assetType: AssetType;
  decimals: number;
  totalSupply: number;
  verifiedAt: number;
  verifiedBy: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface WrapRequest {
  user: string;
  assetAddress: string;
  amount: number;
  assetType: AssetType;
  timestamp: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  fee: number;
  requestId: string;
}

export interface UnwrapRequest {
  user: string;
  wrappedTokenId: string;
  amount: number;
  timestamp: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  fee: number;
  requestId: string;
}

export interface GovernanceProposal {
  id: string;
  proposer: string;
  proposalType: "ADD_ASSET" | "REMOVE_ASSET" | "UPDATE_FEE" | "UPDATE_CONFIG";
  target: string;
  newValue: any;
  description: string;
  votesFor: number;
  votesAgainst: number;
  deadline: number;
  executed: boolean;
  createdAt: number;
}

export interface RiskMetrics {
  wrappedTokenId: string;
  currentRatio: number;
  healthFactor: number;
  liquidationPrice: number;
  riskScore: number;
  lastCalculated: number;
}

export interface AuditLog {
  id: string;
  action: string;
  actor: string;
  target: string;
  data: any;
  timestamp: number;
  blockNumber: number;
}
