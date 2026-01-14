export type VoteRank = 0 | 1 | 2 | 3;
export class Vote {
  constructor(
    public readonly id: string,
    public readonly judgeId: string,
    public readonly modelId: string,
    public rank: VoteRank,
    public readonly createdAt: Date = new Date()
  ) {}
  changeRank(newRank: VoteRank) { this.rank = newRank; }
}
