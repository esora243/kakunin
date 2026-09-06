export class LoginUserRejectedError extends Error {
  code: "login_user_rejected";
  httpStatus: 403;
  clearExistingSession: true;

  constructor() {
    super("Login is not available");
    this.name = "LoginUserRejectedError";
    this.code = "login_user_rejected";
    this.httpStatus = 403;
    this.clearExistingSession = true;
  }
}

export function assertLoginUserCanReceiveSession(user: { deactivated_at?: string | null }) {
  if (user.deactivated_at) {
    throw new LoginUserRejectedError();
  }
}
