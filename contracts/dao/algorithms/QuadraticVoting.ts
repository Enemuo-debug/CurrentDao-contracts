export class QuadraticVoting {
    /**
     * Calculates the voting power (votes) given the token balance.
     * In quadratic voting, voting power = sqrt(tokens).
     */
    public static calculateVotingPower(tokens: number): number {
        if (tokens < 0) return 0;
        return Math.floor(Math.sqrt(tokens));
    }

    /**
     * Calculates the cost in tokens for a given number of votes.
     * cost = votes * votes.
     */
    public static calculateTokenCost(votes: number): number {
        if (votes < 0) return 0;
        return votes * votes;
    }
}
