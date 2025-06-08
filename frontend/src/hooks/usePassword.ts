import { useState } from 'react';
import apiClient from '../lib/utils/apiClient';

interface PasswordForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export function usePassword() {
    const [passwordForm, setPasswordForm] = useState<PasswordForm>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState<string>('');
    const [passwordSuccess, setPasswordSuccess] = useState<string>('');

    const updatePasswordForm = (field: keyof PasswordForm, value: string) => {
        setPasswordForm(prev => ({
            ...prev,
            [field]: value
        }));
        // Clear errors when user starts typing
        if (passwordError) setPasswordError('');
        if (passwordSuccess) setPasswordSuccess('');
    };

    const changePassword = async (): Promise<boolean> => {
        setPasswordError('');
        setPasswordSuccess('');

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setPasswordError('New passwords do not match');
            return false;
        }

        if (passwordForm.newPassword.length < 8) {
            setPasswordError('New password must be at least 8 characters');
            return false;
        }

        try {
            await apiClient.post('/auth/change-password', {
                current_password: passwordForm.currentPassword,
                new_password: passwordForm.newPassword
            });
            setPasswordSuccess('Password updated successfully');
            return true;
        } catch (error: any) {
            setPasswordError(error.response?.data?.detail || 'Failed to update password');
            return false;
        }
    };

    const resetPasswordForm = () => {
        setPasswordForm({
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        });
    };

    return {
        passwordForm,
        passwordError,
        passwordSuccess,
        updatePasswordForm,
        changePassword,
        resetPasswordForm
    };
} 