import { useChatContext } from '@/context/ChatContext';
import debug from 'debug';
import { useState } from 'react';

debug.enable('hooks:*');
// const logger = debug('hooks:useMcpHook');

const defaultA2A = {
  "enso_a2a": {
    "base_url": "https://a2a.enso.sh",
    "agent_card_path": "/.well-known/agent.json"
  }
}

const INIT_A2A_STATE = {
	a2aInfo: null,
	a2aCode: JSON.stringify(defaultA2A, null, 2),
	a2aError: '',
	isLoadingA2AInfo: false,
	a2aInfoError: null,
	isAddingA2A: false,
	hasSavedA2A: false,
}

export default function useA2AHook() {
	const { payload, setPayload } = useChatContext();
	const [a2aCode, setA2ACode] = useState(INIT_A2A_STATE.a2aCode);
	const [a2aError, setA2aError] = useState(INIT_A2A_STATE.a2aError);
	const [isAddingA2A, setIsAddingA2A] = useState(INIT_A2A_STATE.isAddingA2A);
	const [hasSavedA2A, setHasSavedA2A] = useState(INIT_A2A_STATE.hasSavedA2A);
	const [a2aInfo, setA2aInfo] = useState<any[] | null>(INIT_A2A_STATE.a2aInfo);
  const [isLoadingA2AInfo, setIsLoadingA2AInfo] = useState(INIT_A2A_STATE.isLoadingA2AInfo);
  const [a2aInfoError, setA2aInfoError] = useState<string | null>(INIT_A2A_STATE.a2aInfoError);

	const startAddingA2A = () => {
    setIsAddingA2A(true);
  };

	const cancelAddingA2A = () => {
    setIsAddingA2A(false);
    setA2aError('');

		if (payload.a2a) {
			setA2ACode(JSON.stringify(payload.a2a, null, 2));
		} else {
			setA2ACode(INIT_A2A_STATE.a2aCode);
		}
  };

	const saveA2AConfig = () => {
    try {
      // Validate JSON
      const parsedConfig = JSON.parse(a2aCode);
      
      // Update payload	
		setPayload((prev: { a2a: any; }) => ({
			...prev,
			a2a: parsedConfig
		}));
		
		// Update state to show config is saved
		setHasSavedA2A(true);
		
		// Clear any previous errors
		setA2aError('');

	} catch (e) {
		setA2aError('Invalid JSON format. Please check your configuration.');
	}
	};

	const removeA2AConfig = () => {
		// Remove from payload
		setPayload((prev: { a2a: any; }) => {
			const { a2a, ...rest } = prev;
			return rest;
		});
		
		// Update state
		setHasSavedA2A(false);
		
		// Reset to default
		setA2ACode(INIT_A2A_STATE.a2aCode);

		// If removing while in edit mode, we'll keep it open
		if (!isAddingA2A) {
			setIsAddingA2A(false);
		}
	};
	

	return {
		a2aInfo,
		setA2aInfo,
		a2aCode,
		setA2ACode,
		isLoadingA2AInfo,
		setIsLoadingA2AInfo,
		a2aInfoError,
		setA2aInfoError,
		isAddingA2A,
		setIsAddingA2A,
		hasSavedA2A,
		setHasSavedA2A,
		a2aError,
		setA2aError,
		// Actions
		startAddingA2A,
		cancelAddingA2A,
		saveA2AConfig,
		removeA2AConfig,
	}
}