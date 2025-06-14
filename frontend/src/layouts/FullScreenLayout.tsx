function FullScreenLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen flex flex-col bg-background">
			{children}
		</div>
	)
}

export default FullScreenLayout;