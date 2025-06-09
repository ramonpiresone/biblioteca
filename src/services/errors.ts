/**
 * Custom error for Loan validation issues
 */
export class LoanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoanValidationError';
  }
}

/**
 * Custom error for Loan not found
 */
export class LoanNotFoundError extends Error {
  constructor(loanId: string) {
    super(`Empréstimo ${loanId} não encontrado`);
    this.name = 'LoanNotFoundError';
  }
}
