import { Governance } from '../../contracts/dao/Governance';
import { WattToken } from '../../contracts/token/WattToken';
import { ProposalStatus } from '../../contracts/dao/structures/ProposalStructure';

describe('Governance Contract Tests', () => {
    let governance: Governance;
    let token: WattToken;
    
    const admin = '0xAdmin';
    const user1 = '0xUser1'; // Proposer
    const user2 = '0xUser2'; // Voter
    const user3 = '0xUser3'; // Voter
    const user4 = '0xUser4'; // Delegatee

    beforeEach(() => {
        token = new WattToken(admin);
        governance = new Governance(token, admin);
        
        // Setup initial tokens
        token.grantMinterRole(admin, admin);
        token.grantBurnerRole(admin, admin);
        token.mint(admin, user1, 1000); // Proposer threshold is 100
        token.mint(admin, user2, 100);  // 10 votes (QV)
        token.mint(admin, user3, 400);  // 20 votes (QV)
        token.mint(admin, user4, 25);   // 5 votes (QV)
    });

    it('should allow proposing if user has enough tokens', () => {
        const targets = ['0xTarget'];
        const values = [0];
        const calldatas = ['0x'];
        const description = 'Proposal 1: Upgrade protocol';

        const proposalId = governance.propose(targets, values, calldatas, description, user1);
        expect(proposalId).toBeDefined();
        
        const proposal = governance.getProposal(proposalId);
        expect(proposal.proposer).toBe(user1);
        expect(proposal.description).toBe(description);
        expect(proposal.status).toBe(ProposalStatus.Active);
    });

    it('should fail proposing if user has insufficient tokens', () => {
        const targets = ['0xTarget'];
        const values = [0];
        const calldatas = ['0x'];
        const description = 'Proposal 2: Low balance';

        // Set user balance below threshold (100)
        token.burn(admin, user2, 50); // Now has 50
        
        expect(() => {
            governance.propose(targets, values, calldatas, description, user2);
        }).toThrow('Governance: insufficient tokens to propose');
    });

    it('should calculate voting power correctly (Quadratic Voting)', () => {
        // user2 balance = 100, votes = sqrt(100) = 10
        expect(governance.getVotingPower(user2)).toBe(10);
        
        // user3 balance = 400, votes = sqrt(400) = 20
        expect(governance.getVotingPower(user3)).toBe(20);
    });

    it('should handle delegation correctly', () => {
        // user2 delegates to user4
        governance.delegate(user4, user2);
        
        // user4 voting power = sqrt(balance(u4) + balance(u2)) = sqrt(100 + 25) = sqrt(125) = 11
        expect(governance.getVotingPower(user4)).toBe(11);
    });

    it('should allow casting votes and updating proposal totals', async () => {
        const proposalId = governance.propose(['0x1'], [0], ['0x'], 'Test Proposal', user1);
        
        // Fast forward slightly to allow voting (since we have a 1s delay)
        // In this sim, we can just cast vote as our logic is simple
        
        governance.castVote(proposalId, 1, user2); // 10 votes (For)
        governance.castVote(proposalId, 0, user3); // 20 votes (Against)
        
        const proposal = governance.getProposal(proposalId);
        expect(proposal.forVotes).toBe(10);
        expect(proposal.againstVotes).toBe(20);
        
        const receipt = governance.getReceipt(proposalId, user2);
        expect(receipt.hasVoted).toBe(true);
        expect(receipt.support).toBe(1);
        expect(receipt.weight).toBe(10);
    });

    it('should prevent double voting', () => {
        const proposalId = governance.propose(['0x1'], [0], ['0x'], 'Test Multi-vote', user1);
        governance.castVote(proposalId, 1, user2);
        
        expect(() => {
            governance.castVote(proposalId, 1, user2);
        }).toThrow('Governance: already voted');
    });

    it('should fail execution if quorum is not reached', () => {
        // Quorum is 1000 by default in our class
        const proposalId = governance.propose(['0x1'], [0], ['0x'], 'Test Quorum', user1);
        
        governance.castVote(proposalId, 1, user2); // 10 votes
        
        expect(() => {
            governance.execute(proposalId, admin);
        }).toThrow('Governance: proposal not queued for execution');
    });
    
    it('should allow canceling a proposal by proposer or admin', () => {
        const proposalId = governance.propose(['0x1'], [0], ['0x'], 'Cancel me', user1);
        governance.cancel(proposalId, user1);
        
        expect(governance.getProposalStatus(proposalId)).toBe(ProposalStatus.Canceled);
    });
});
