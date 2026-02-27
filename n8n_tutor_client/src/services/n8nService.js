import { BACKEND_BASE_URL, N8N_WEBHOOK_URL } from '../constants.js';

export async function callN8nWorkflow(prompt, files, chatId, agentId) {
  const fileNames = files.map(f => f.name);

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        sessionId: agentId,
        chatId: chatId,
        documents: fileNames
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n workflow failed with status: ${response.status}`);
    }

    const data = (await response.json())[0];

    if (!data.type || (data.type !== 'info' && data.type !== 'query')) {
      throw new Error('Invalid response format from n8n. "type" must be "info" or "query".');
    }

    return data;

  } catch (error) {
    console.error("Error calling n8n workflow:", error);
    return {
      type: 'info',
      content: `Sorry, I encountered an error trying to process your request: ${error.message}. Please check the console for details and ensure the backend is running.`,
      references: [],
    };
  }
}

/**
 * Executes a SQL query
 * @param {string} query - The SQL query to execute.
 * @returns {Promise<Array>} - A promise that resolves to an array of results from the query.
 */
export async function runQuery(query) {
  if (!query || !query.trim()) {
    console.warn('Empty query provided to runQuery');
    return [];
  }

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // The body format is identical to what we need
      body: JSON.stringify({
        query: query,
      }),
    });

    const result = await response.json();

    // The backend sends a detailed error message in the 'detail' key on failure
    if (!response.ok) {
      const errorMessage = result.detail || `Request failed with status: ${response.status}`;
      throw new Error(errorMessage);
    }

    // Handle the successful response structure from our backend
    if (result.status === 'success' && Array.isArray(result.data)) {
      return result.data;
    } else {
      // This case handles unexpected successful responses from the backend
      throw new Error('Invalid response format from backend.');
    }

  } catch (error) {
    console.error("Error running query:", error);
    // Re-throw the error so the calling function (e.g., a UI component)
    // can catch it and display a user-friendly message.
    throw error;
  }
}


/**
 * Gets a PDF file URL or downloads it from the public folder.
 * @param {string} fileName - The name of the file to access (without the .pdf extension).
 * @param {boolean} [download=false] - Whether to download the file or just return the URL.
 * @returns {Promise<string|undefined>} - If download=false, returns the URL; otherwise undefined.
 */
export async function downloadPdfFile(fileName, download = false) {
  try {
    // Construct the path to the PDF file in the public folder
    const pdfUrl = `/docs/${fileName}.pdf`;

    // Check if the file exists by making a HEAD request
    const response = await fetch(pdfUrl, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`File not found: ${fileName}.pdf`);
    }

    if (download) {
      // Create a temporary anchor (<a>) element to trigger the download
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.setAttribute('download', `${fileName}.pdf`); // Set the download filename

      // Append to the document, click, and then remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return undefined;
    } else {
      // Return the URL for viewing
      return pdfUrl;
    }
  } catch (error) {
    console.error(`Error accessing file "${fileName}.pdf":`, error);
    // You could show an alert or a notification to the user here
    alert(error.message);
    return undefined;
  }
}