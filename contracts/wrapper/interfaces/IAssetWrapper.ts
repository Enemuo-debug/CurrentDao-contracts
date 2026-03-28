/**
 * @title IAssetWrapper
 * @dev Interface for the Asset Wrapper Contract
 * @notice Enables representation of external assets on the Stellar network
 */
export interface IAssetWrapper {
    // Core wrapping functions
    wrapAsset(caller: string, assetAddress: string, amount: number, assetType: AssetType): Promise<boolean>;
    unwrapAsset(caller: string, wrappedTokenId: string, amount: number): Promise<boolean>;
    
    // Collateral management
    depositCollateral(caller: string, wrappedTokenId: string, amount: number): Promise<boolean>;
    withdrawCollateral(caller: string, wrappedTokenId: string, amount: number): Promise<boolean>;
    
    // Asset verification
    verifyAsset(assetAddress: string, assetType: AssetType): Promise<boolean>;
    isAssetSupported(assetAddress: string): boolean;
    
    // Fee calculation
    calculateWrapFee(assetType: AssetType, amount: number): number;
    calculateUnwrapFee(wrappedTokenId: string, amount: number): number;
    
    // Price tracking
    getAssetPrice(assetAddress: string): number;
    getCollateralRatio(wrappedTokenId: string): number;
    
    // Governance
    addSupportedAsset(caller: string, assetAddress: string, assetType: AssetType): Promise<boolean>;
    removeSupportedAsset(caller: string, assetAddress: string): Promise<boolean>;
    updateFeeStructure(caller: string, assetType: AssetType, wrapFee: number, unwrapFee: number): Promise<boolean>;
    
    // View functions
    getWrappedTokenInfo(wrappedTokenId: string): WrappedTokenInfo | null;
    getUserWrappedTokens(user: string): string[];
    getTotalCollateral(wrappedTokenId: string): number;
    
    // Events
    onAssetWrapped(callback: (event: AssetWrappedEvent) => void): void;
    onAssetUnwrapped(callback: (event: AssetUnwrappedEvent) => void): void;
    onCollateralDeposited(callback: (event: CollateralDepositedEvent) => void): void;
    onCollateralWithdrawn(callback: (event: CollateralWithdrawnEvent) => void): void;
}

export enum AssetType {
    ERC20 = "ERC20",
    ERC721 = "ERC721",
    ERC1155 = "ERC1155",
    NATIVE = "NATIVE",
    STABLECOIN = "STABLECOIN"
}

export interface WrappedTokenInfo {
    id: string;
    originalAssetAddress: string;
    assetType: AssetType;
    totalSupply: number;
    totalCollateral: number;
    collateralRatio: number;
    wrapFee: number;
    unwrapFee: number;
    isActive: boolean;
    createdAt: number;
}

export interface AssetWrappedEvent {
    user: string;
    originalAssetAddress: string;
    wrappedTokenId: string;
    amount: number;
    fee: number;
    timestamp: number;
}

export interface AssetUnwrappedEvent {
    user: string;
    wrappedTokenId: string;
    originalAssetAddress: string;
    amount: number;
    fee: number;
    timestamp: number;
}

export interface CollateralDepositedEvent {
    user: string;
    wrappedTokenId: string;
    amount: number;
    timestamp: number;
}

export interface CollateralWithdrawnEvent {
    user: string;
    wrappedTokenId: string;
    amount: number;
    timestamp: number;
}
