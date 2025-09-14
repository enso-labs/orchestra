function FullScreenLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="h-full flex flex-col bg-background overflow-hidden">
			{children}
		</div>
	);
}

export default FullScreenLayout;
