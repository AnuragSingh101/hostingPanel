import { useState } from 'react';

export default function useSshConnection(initialPort = 22) {
  const [formData, setFormData] = useState({
    host: '',
    port: initialPort,
    username: '',
    password: '',
    privateKey: '',
  });
  const [usePrivateKey, setUsePrivateKey] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAuth = () => setUsePrivateKey((v) => !v);

  const validate = () => {
    if (!formData.host || !formData.username) {
      alert('Host and Username are required');
      return false;
    }
    if (!usePrivateKey && !formData.password) {
      alert('Password is required');
      return false;
    }
    if (usePrivateKey && !formData.privateKey) {
      alert('Private key is required');
      return false;
    }
    return true;
  };

  const getCredentials = () => ({
    host: formData.host,
    port: Number(formData.port) || initialPort,
    username: formData.username,
    ...(usePrivateKey
      ? { privateKey: formData.privateKey }
      : { password: formData.password }),
  });

  return {
    formData,
    usePrivateKey,
    handleChange,
    toggleAuth,
    validate,
    getCredentials,
  };
}
