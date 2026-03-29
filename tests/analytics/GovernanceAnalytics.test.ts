import { GovernanceAnalytics } from '../../contracts/analytics/GovernanceAnalytics';
import { Governance } from '../../contracts/dao/Governance';
import { WattToken } from '../../contracts/token/WattToken';

describe('GovernanceAnalytics Tests', () => {
    let analytics: GovernanceAnalytics;
    let governance: Governance;
    let token: WattToken;

    const admin = '0xAdmin';
    const user1 = '0xUser1';
    const user2 = '0xUser2';

    beforeEach(() => {
        token = new WattToken(admin);
        governance = new Governance(token, admin);
        analytics = new GovernanceAnalytics(governance);
        
        token.grantMinterRole(admin, admin);
        token.mint(admin, user1, 1000);
        token.mint(admin, user2, 500);
    });

    it('should track new proposals for analytics', () => {
        const id = governance.propose(['0xT'], [0], ['0x'], 'Proposal 1', user1);
        analytics.trackProposal(id);
        
        const metrics = analytics.getParticipationMetrics(id);
        expect(metrics.proposalId).toBe(id);
        expect(metrics.totalVotes).toBe(0);
    });

    it('should properly record and analyze voting patterns', () => {
        const id = governance.propose(['0xT'], [0], ['0x'], 'Proposal 1', user1);
        analytics.trackProposal(id);
        
        // Advance time to start voting
        const realDateNow = Date.now;
        Date.now = jest.fn(() => realDateNow() + 2000);
        
        const weight = governance.castVote(id, 1, user2); // voter 2 has sqrt(500) votes
        analytics.recordVote(id, user2, 1, weight);

        const voterBehavior = analytics.getVoterBehavior(user2);
        expect(voterBehavior.voter).toBe(user2);
        expect(voterBehavior.proposalsVoted).toBe(1);
        
        Date.now = realDateNow;
    });

    it('should calculate DAO health engagement levels', () => {
        const id1 = governance.propose(['0xT'], [0], ['0x'], 'Proposal 1', user1);
        analytics.trackProposal(id1);
        
        const health = analytics.getDAOHealth();
        expect(health.totalProposals).toBe(1);
        // Expect a valid numeric health score
        expect(health.networkEngagement).toBeGreaterThanOrEqual(0);
    });

    it('should calculate voter retention correctly', () => {
        const id1 = governance.propose(['0xT1'], [0], ['0x'], 'P1', user1);
        const id2 = governance.propose(['0xT2'], [0], ['0x'], 'P2', user1);
        
        analytics.trackProposal(id1);
        analytics.trackProposal(id2);
        
        analytics.recordVote(id1, user1, 1, 10);
        analytics.recordVote(id2, user1, 1, 10);
        
        const retention = analytics.calculateVoterRetention();
        expect(retention).toBe(100); // 1 active voter, he voted in both
    });
});
