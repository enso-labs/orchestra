import { useState, useEffect } from 'react';
import YAML from 'yaml';
import Editor from '@monaco-editor/react';

interface Props {
  jsonData: object;
  options?: any;
  theme?: string;
  defaultLanguage?: string;
}

const defaultOptions = {
  tabSize: 2,
  insertSpaces: true,
  fontSize: 14
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
    <>
    {error && <pre className="text-red-500">{error}</pre>}
      <Editor
        value={YAML.stringify(data)}
        onChange={handleChange}
        defaultLanguage={props.defaultLanguage ?? 'yaml'}
        theme={props.theme ?? 'vs-dark'}
        options={props.options ?? defaultOptions}
      />
    </>
  );
}

export default MonacoEditor;