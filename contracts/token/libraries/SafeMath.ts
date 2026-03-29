export class SafeMath {
    public static add(a: number, b: number): number {
        const c = a + b;
        if (c < a) {
            throw new Error("SafeMath: addition overflow");
        }
        return c;
    }

    public static sub(a: number, b: number): number {
        if (b > a) {
            throw new Error("SafeMath: subtraction overflow");
        }
        return a - b;
    }

    public static mul(a: number, b: number): number {
        if (a === 0) return 0;
        const c = a * b;
        return c;
    }

    public static div(a: number, b: number): number {
        if (b === 0) {
            throw new Error("SafeMath: division by zero");
        }
        const c = Math.floor(a / b);
        return c;
    }
}