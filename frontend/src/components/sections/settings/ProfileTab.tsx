import { FormEvent } from 'react';
import { usePassword } from '../../../hooks/usePassword';

export default function ProfileTab() {
    const {
        passwordForm,
        passwordError,
        passwordSuccess,
        updatePasswordForm,
        changePassword,
        resetPasswordForm
    } = usePassword();

    const handlePasswordChange = async (e: FormEvent) => {
        e.preventDefault();
        
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            return;
        }

        const success = await changePassword();
        if (success) {
            resetPasswordForm();
        }
    };

    return (
        <div className="bg-card text-card-foreground rounded-lg shadow-md p-6 min-w-[80vw] lg:min-w-[40vw]">
            <h1 className="text-2xl font-bold text-foreground mb-6">Profile Settings</h1>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground mb-1">
                        Current Password
                    </label>
                    <input
                        id="currentPassword"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => updatePasswordForm('currentPassword', e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-foreground mb-1">
                        New Password
                    </label>
                    <input
                        id="newPassword"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => updatePasswordForm('newPassword', e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        required
                        minLength={8}
                    />
                </div>

                <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1">
                        Confirm New Password
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => updatePasswordForm('confirmPassword', e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                        required
                    />
                </div>

                {passwordError && (
                    <p className="text-sm text-destructive">{passwordError}</p>
                )}
                {passwordSuccess && (
                    <p className="text-sm text-green-500">{passwordSuccess}</p>
                )}

                <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                    Change Password
                </button>
            </form>
        </div>
    );
} 