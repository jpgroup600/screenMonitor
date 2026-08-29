public class ChangePasswordDto
{
    public string OldPassword { get; set; }
    public string NewPassword { get; set; }
}

public class ResetPasswordDto
{
    public string NewPassword { get; set; }
}
