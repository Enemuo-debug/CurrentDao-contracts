export interface IERC721 {
    balanceOf(owner: string): number;
    ownerOf(tokenId: string): string;
    safeTransferFrom(from: string, to: string, tokenId: string, data?: string): void;
    transferFrom(from: string, to: string, tokenId: string): void;
    approve(to: string, tokenId: string): void;
    getApproved(tokenId: string): string;
    setApprovalForAll(operator: string, approved: boolean): void;
    isApprovedForAll(owner: string, operator: string): boolean;
}