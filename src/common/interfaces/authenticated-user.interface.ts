//قالب اطلاعات دریافتی از دیتا بیس
export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}