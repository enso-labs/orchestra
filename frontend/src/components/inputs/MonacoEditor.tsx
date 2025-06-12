import { useState, useEffect } from 'react';
import YAML from 'yaml';
import Editor from '@monaco-editor/react';

interface Props {
  jsonData: object;
  handleChange: (val: any) => void;
}

function MonacoEditor(props: Props) {
  const [data, setData] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    setData(props.jsonData);
  }, [props]);

  const handleChange = (val: any) => {
    try {
      let obj = YAML.parse(val);
      setData(obj);
      setError('');
    } catch (err: any) {
      setError(`${err.name}: ${err.message}`);
    }
  };

  return (
    <div>
      <Editor
        value={YAML.stringify(data)}
        onChange={handleChange}
        defaultLanguage="yaml"
        height="100vh"
        theme="vs-dark"
        options={{
          tabSize: 2,
          insertSpaces: true
        }}
      />
      <pre>{error}</pre>
    </div>
  );
}

export default MonacoEditor;