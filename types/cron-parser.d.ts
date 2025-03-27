declare module 'cron-parser' {
  export interface CronExpression {
    next(): { toDate(): Date };
    prev(): { toDate(): Date };
  }

  export function parseExpression(expression: string): CronExpression;
} 