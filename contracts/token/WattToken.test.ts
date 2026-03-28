import { WattToken } from '../../contracts/token/WattToken';

describe('WattToken ERC-20 Tests', () => {
    let token: WattToken;
    const admin = '0xAdmin';
    const minter = '0xMinter';
    const burner = '0xBurner';
    const user1 = '0xUser1';
    const user2 = '0xUser2';

    beforeEach(() => {
        token = new WattToken(admin);
    });

    it('should have correct metadata', () => {
        expect(token.name).toBe('Energy Watt');
        expect(token.symbol).toBe('WATT');
        expect(token.decimals).toBe(18);
        expect(token.totalSupply()).toBe(0);
    });

    it('should allow admin to grant roles', () => {
        token.grantMinterRole(admin, minter);
        token.grantBurnerRole(admin, burner);
        
        const events = token.getPastEvents();
        const roleEvents = events.filter(e => e.event === 'RoleGranted');
        expect(roleEvents.length).toBe(2);
    });

    it('should allow authorized minter to mint tokens', () => {
        token.grantMinterRole(admin, minter);
        token.mint(minter, user1, 1000);
        
        expect(token.balanceOf(user1)).toBe(1000);
        expect(token.totalSupply()).toBe(1000);
    });

    it('should revert if unauthorized user tries to mint', () => {
        expect(() => {
            token.mint(user1, user2, 1000);
        }).toThrow("AccessControl: caller is not a minter");
    });

    it('should allow token transfers', () => {
        token.grantMinterRole(admin, minter);
        token.mint(minter, user1, 1000);
        
        token.executeTransfer(user1, user2, 400);
        
        expect(token.balanceOf(user1)).toBe(600);
        expect(token.balanceOf(user2)).toBe(400);
    });

    it('should allow authorized burner to burn tokens', () => {
        token.grantMinterRole(admin, minter);
        token.grantBurnerRole(admin, burner);
        
        token.mint(minter, user1, 1000);
        token.burn(burner, user1, 300);
        
        expect(token.balanceOf(user1)).toBe(700);
        expect(token.totalSupply()).toBe(700);
    });

    it('should fail transfers when paused', () => {
        token.grantMinterRole(admin, minter);
        token.mint(minter, user1, 1000);
        
        token.pause(admin);
        
        expect(() => {
            token.executeTransfer(user1, user2, 100);
        }).toThrow("Pausable: paused");
    });

    it('should resume normal functions when unpaused', () => {
        token.grantMinterRole(admin, minter);
        token.mint(minter, user1, 1000);
        
        token.pause(admin);
        token.unpause(admin);
        
        token.executeTransfer(user1, user2, 100);
        expect(token.balanceOf(user2)).toBe(100);
    });

    it('should protect against underflow using SafeMath', () => {
        expect(() => {
            token.executeTransfer(user1, user2, 100); // balance is 0
        }).toThrow("SafeMath: subtraction overflow");
    });
});