import api from '../services/api';

/**
 * Télécharge un fichier (PDF ou ZIP) depuis l'API en utilisant
 * le token JWT dans le header Authorization (pas en URL).
 */
export async function downloadFile(endpoint, filename) {
  try {
    const response = await api.get(endpoint, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Erreur lors du téléchargement. Veuillez réessayer.');
    console.error(err);
  }
}
