import { TimelockController } from '../../contracts/timelock/TimelockController';
import { OperationStatus } from '../../contracts/timelock/structures/QueueStructure';

describe('TimelockController Tests', () => {
    let timelock: TimelockController;
    
    const admin = '0xAdmin';
    const proposer = '0xProposer';
    const executor = '0xExecutor';
    const other = '0xOther';

    const minDelay = 48 * 60 * 60 * 1000; // 48 hours in ms

    beforeEach(() => {
        timelock = new TimelockController(minDelay, [proposer], [executor], admin);
    });

    it('should allow proposing a scheduled operation', () => {
        const target = '0xTarget';
        const value = 0;
        const data = '0x...';
        const predecessor = '0x0';
        const salt = '0xSalt';
        const delay = minDelay;

        const id = timelock.schedule(target, value, data, predecessor, salt, delay, proposer);
        expect(id).toBeDefined();
        expect(timelock.isOperationPending(id)).toBe(true);
    });

    it('should fail scheduling if delay is below minimum', () => {
        const shortDelay = minDelay - 1000;
        expect(() => {
            timelock.schedule('0x1', 0, '0x', '0x', '0x', shortDelay, proposer);
        }).toThrow("Timelock: delay below minimum");
    });

    it('should fail execution before delay passes', () => {
        const target = '0xT';
        const value = 0;
        const data = '0x';
        const predecessor = '0x';
        const salt = '0xSalt';
        
        timelock.schedule(target, value, data, predecessor, salt, minDelay, proposer);
        
        expect(() => {
            timelock.execute(target, value, data, predecessor, salt, executor);
        }).toThrow("Timelock: operation delay not passed");
    });

    it('should allow cancellation by authorized account', () => {
        const target = '0xT';
        const id = timelock.schedule(target, 0, '0x', '0x', '0x', minDelay, proposer);
        
        timelock.cancel(id, admin); // Admin is default canceller
        
        expect(timelock.isOperationPending(id)).toBe(false);
    });

    it('should prevent unauthorized execution', () => {
        const target = '0xT';
        const value = 0;
        const data = '0x';
        const predecessor = '0x';
        const salt = '0xS';
        
        timelock.schedule(target, value, data, predecessor, salt, minDelay, proposer);
        
        expect(() => {
            timelock.execute(target, value, data, predecessor, salt, other);
        }).toThrow("Timelock: caller is not an executor");
    });

    it('should update roles by admin', () => {
        timelock.grantRole('PROPOSER', other, admin);
        
        const id = timelock.schedule('0xT', 0, '0x', '0x', '0x', minDelay, other);
        expect(timelock.isOperationPending(id)).toBe(true);
    });
});
