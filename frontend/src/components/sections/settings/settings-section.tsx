import { useState } from 'react';
import TokensTab from './TokensTab';
import ProfileTab from './ProfileTab';

export default function SettingsSection() {
	const [activeTab, setActiveTab] = useState('tokens');

	return (
		<main className="max-w-8xl mx-auto p-6">
			{/* Tabs */}
			<div className="border-b border-border mb-6">
				<div className="flex space-x-8">
					<button
						onClick={() => setActiveTab('tokens')}
						className={`pb-2 px-1 ${
							activeTab === 'tokens'
								? 'border-b-2 border-primary font-semibold text-foreground'
								: 'text-muted-foreground'
						}`}
					>
						Tokens
					</button>
					<button
						onClick={() => setActiveTab('profile')}
						className={`pb-2 px-1 ${
							activeTab === 'profile'
								? 'border-b-2 border-primary font-semibold text-foreground'
								: 'text-muted-foreground'
						}`}
					>
						Profile
					</button>
				</div>
			</div>

			{activeTab === 'tokens' && <TokensTab />}
			{activeTab === 'profile' && <ProfileTab />}
		</main>
	);
}