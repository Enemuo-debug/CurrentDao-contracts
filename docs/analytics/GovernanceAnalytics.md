# 📊 Governance Analytics

The **Governance Analytics** system provides deep insights into the health, participation, and trends within the Current DAO. By tracking and analyzing voting patterns and proposal success rates, it helps the DAO community and core contributors make informed decisions about governance parameters and community engagement.

## 🌟 Key Features

### 📉 Participation Rate Tracking
Every proposal's engagement level is measured by tracking the number of unique voters and the total voting power cast. This data is essential for understanding whether the DAO remains truly decentralized or if participation is waning.

### 🧬 Voting Pattern Analysis
The system analyzes voter behavior to identify trends, such as:
-   **Lurker behavior**: Users who hold tokens but don't vote.
-   **Consistent participation**: Loyal voters who engage in every proposal.
-   **Quadratic influence**: How much $WATT is actually converted to voting power across the DAO.

### 🏥 DAO Health Indicators
Integrated metrics provide a real-time status of the DAO's "vibrancy," which includes:
-   **Voter Retention**: Percentage of voters who participate in multiple proposals over time.
-   **Network Engagement Score**: A weighted average total of participation rates, success rates, and unique voter count.

### 📤 Data Export & Performance Benchmarking
Allows export of governance data in JSON format for external analysis or visualization in dashboards. Additionally, it offers benchmarking to compare the DAO's performance against historical data or other decentralized organizations.

## ⚙️ How it Works

The analytics system works in tandem with the **Governance** contract. When a proposal is created or a vote is cast, these events are recorded in the analytics engine to maintain up-to-date metrics.

### 🧑‍💻 Technical Details

-   **Contract**: `GovernanceAnalytics.ts`
-   **Interface**: `IGovernanceAnalytics.ts`
-   **Library**: `AnalyticsLib.ts`
-   **Structures**: `AnalyticsStructure.ts`

### 🏗️ Data Aggregation
Metrics are aggregated asynchronously to minimize performance impact. The calculation of the health score uses the `AnalyticsLib`, which applies weights to different metrics (engagement, success, etc.) to arrive at a single value from 0 to 100.
