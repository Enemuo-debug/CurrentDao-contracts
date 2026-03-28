import { IERC20 } from './interfaces/IERC20';
import { SafeMath } from './libraries/SafeMath';

export class WattToken implements IERC20 {
    public readonly name: string = "Energy Watt";
    public readonly symbol: string = "WATT";
    public readonly decimals: number = 18;

    private _totalSupply: number = 0;
    private balances: Map<string, number> = new Map();
    private allowances: Map<string, Map<string, number>> = new Map();
    
    private admin: string;
    private minters: Set<string> = new Set();
    private burners: Set<string> = new Set();
    
    private paused: boolean = false;
    private events: any[] = [];

    constructor(adminAddress: string) {
        this.admin = adminAddress;
        this.emitEvent('Initialized', { admin: adminAddress });
    }

    // --- Modifiers ---

    private whenNotPaused() {
        if (this.paused) throw new Error("Pausable: paused");
    }

    private onlyAdmin(caller: string) {
        if (caller !== this.admin) throw new Error("AccessControl: caller is not an admin");
    }

    // --- Administration & Roles ---

    public pause(caller: string) {
        this.onlyAdmin(caller);
        this.paused = true;
        this.emitEvent('Paused', { by: caller });
    }

    public unpause(caller: string) {
        this.onlyAdmin(caller);
        this.paused = false;
        this.emitEvent('Unpaused', { by: caller });
    }

    public grantMinterRole(caller: string, account: string) {
        this.onlyAdmin(caller);
        this.minters.add(account);
        this.emitEvent('RoleGranted', { role: 'MINTER', account });
    }

    public grantBurnerRole(caller: string, account: string) {
        this.onlyAdmin(caller);
        this.burners.add(account);
        this.emitEvent('RoleGranted', { role: 'BURNER', account });
    }

    // --- Energy Specific Features ---

    public mint(caller: string, to: string, amount: number): boolean {
        this.whenNotPaused();
        if (!this.minters.has(caller) && caller !== this.admin) {
            throw new Error("AccessControl: caller is not a minter");
        }
        if (!to) throw new Error("ERC20: mint to the zero address");

        this._totalSupply = SafeMath.add(this._totalSupply, amount);
        const currentBalance = this.balances.get(to) || 0;
        this.balances.set(to, SafeMath.add(currentBalance, amount));
        
        this.emitEvent('Transfer', { from: '0x0', to, value: amount });
        this.emitEvent('EnergyMinted', { producer: to, amount });
        return true;
    }

    public burn(caller: string, from: string, amount: number): boolean {
        this.whenNotPaused();
        if (!this.burners.has(caller) && caller !== from) {
            throw new Error("AccessControl: caller is not a burner or owner");
        }
        
        const accountBalance = this.balances.get(from) || 0;
        this.balances.set(from, SafeMath.sub(accountBalance, amount));
        this._totalSupply = SafeMath.sub(this._totalSupply, amount);
        
        this.emitEvent('Transfer', { from, to: '0x0', value: amount });
        this.emitEvent('EnergyConsumed', { consumer: from, amount });
        return true;
    }

    // --- ERC20 Implementation ---

    public totalSupply(): number {
        return this._totalSupply;
    }

    public balanceOf(account: string): number {
        return this.balances.get(account) || 0;
    }

    public transfer(recipient: string, amount: number): boolean {
        return this._transfer("mock_caller", recipient, amount);
    }
    
    public executeTransfer(sender: string, recipient: string, amount: number): boolean {
        return this._transfer(sender, recipient, amount);
    }

    private _transfer(sender: string, recipient: string, amount: number): boolean {
        this.whenNotPaused();
        if (!sender || !recipient) throw new Error("ERC20: transfer from/to the zero address");

        const senderBalance = this.balances.get(sender) || 0;
        this.balances.set(sender, SafeMath.sub(senderBalance, amount));
        
        const recipientBalance = this.balances.get(recipient) || 0;
        this.balances.set(recipient, SafeMath.add(recipientBalance, amount));

        this.emitEvent('Transfer', { from: sender, to: recipient, value: amount });
        return true;
    }

    public allowance(owner: string, spender: string): number {
        return this.allowances.get(owner)?.get(spender) || 0;
    }

    public approve(spender: string, amount: number, caller: string = "mock_caller"): boolean {
        this.whenNotPaused();
        if (!this.allowances.has(caller)) this.allowances.set(caller, new Map());
        this.allowances.get(caller)!.set(spender, amount);
        this.emitEvent('Approval', { owner: caller, spender, value: amount });
        return true;
    }

    public transferFrom(sender: string, recipient: string, amount: number): boolean {
        // Simplification for mock: skipping allowance deduction logic for brevity, assuming approval is verified upstream
        return this._transfer(sender, recipient, amount);
    }

    private emitEvent(eventName: string, data: any) {
        this.events.push({ event: eventName, timestamp: Date.now(), data });
    }
    public getPastEvents(): any[] { return [...this.events]; }
}