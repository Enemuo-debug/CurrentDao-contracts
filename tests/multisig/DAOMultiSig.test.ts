import { DAOMultiSig } from '../../contracts/multisig/DAOMultiSig';

describe('DAOMultiSig Tests', () => {
    let multiSig: DAOMultiSig;
    const owner1 = '0xOwner1';
    const owner2 = '0xOwner2';
    const owner3 = '0xOwner3';
    const nonOwner = '0xNonOwner';

    beforeEach(() => {
        multiSig = new DAOMultiSig([owner1, owner2, owner3], 2);
    });

    it('should initialize with correct owners and threshold', () => {
        const owners = multiSig.getOwners();
        expect(owners.length).toBe(3);
        expect(owners).toContain(owner1);
        expect(owners).toContain(owner2);
        expect(owners).toContain(owner3);
    });

    it('should allow owner to submit transaction', () => {
        const to = '0xTarget';
        const value = 100;
        const data = '0xabc';

        const txId = multiSig.submitTransaction(to, value, data, owner1);
        expect(txId).toBeDefined();
        
        const tx = multiSig.getTransaction(txId);
        expect(tx.to).toBe(to);
        expect(tx.value).toBe(value);
        expect(tx.data).toBe(data);
    });

    it('should fail if non-owner tries to submit transaction', () => {
        expect(() => {
            multiSig.submitTransaction('0xT', 0, '0x', nonOwner);
        }).toThrow("MultiSig: caller is not an owner");
    });

    it('should allow multiple owners to confirm transaction', () => {
        const txId = multiSig.submitTransaction('0xT', 0, '0x', owner1);
        
        multiSig.confirmTransaction(txId, owner1);
        multiSig.confirmTransaction(txId, owner2);
        
        const tx = multiSig.getTransaction(txId);
        expect(tx.numConfirmations).toBe(2);
        expect(multiSig.isConfirmed(txId)).toBe(true);
    });

    it('should prevent duplicate confirmation from same owner', () => {
        const txId = multiSig.submitTransaction('0xT', 0, '0x', owner1);
        multiSig.confirmTransaction(txId, owner1);
        
        expect(() => {
            multiSig.confirmTransaction(txId, owner1);
        }).toThrow("MultiSig: already confirmed");
    });

    it('should allow execution once threshold is reached', () => {
        const txId = multiSig.submitTransaction('0xT', 0, '0x', owner1);
        multiSig.confirmTransaction(txId, owner1);
        multiSig.confirmTransaction(txId, owner2);
        
        multiSig.executeTransaction(txId, owner3); // Any owner can trigger execution once confirmed
        
        const tx = multiSig.getTransaction(txId);
        expect(tx.executed).toBe(true);
    });

    it('should fail execution without sufficient confirmations', () => {
        const txId = multiSig.submitTransaction('0xT', 0, '0x', owner1);
        multiSig.confirmTransaction(txId, owner1);
        
        expect(() => {
            multiSig.executeTransaction(txId, owner2);
        }).toThrow("MultiSig: insufficient confirmations");
    });

    it('should allow revoking confirmation', () => {
        const txId = multiSig.submitTransaction('0xT', 0, '0x', owner1);
        multiSig.confirmTransaction(txId, owner1);
        multiSig.revokeConfirmation(txId, owner1);
        
        const tx = multiSig.getTransaction(txId);
        expect(tx.numConfirmations).toBe(0);
    });
});
