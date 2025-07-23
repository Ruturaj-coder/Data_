// Simple Flask Backend Service
// Matches the Flask backend endpoints in app.py

export interface AgentResponse {
  response: string;
  tool_calls_made: number;
}

export class FlaskServiceError extends Error {
  constructor(message: string, public service: string) {
    super(message);
    this.name = 'FlaskServiceError';
  }
}

class FlaskService {
  private baseURL: string;

  constructor() {
    this.baseURL = 'http://localhost:5000';
  }

  async sendAgentMessage(message: string): Promise<AgentResponse> {
    const url = `${this.baseURL}/api/agent`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new FlaskServiceError(data.error || 'Unknown error', 'api');
      }
      // Lambda returns { statusCode, body } where body is a JSON string
      let bodyObj: any = {};
      try {
        bodyObj = JSON.parse(data.body);
      } catch (e) {
        throw new FlaskServiceError('Malformed Lambda body: ' + data.body, 'api');
      }
      return {
        response: bodyObj.response,
        tool_calls_made: bodyObj.tool_calls_made
      };
    } catch (error) {
      if (error instanceof FlaskServiceError) throw error;
      throw new FlaskServiceError(
        error instanceof Error ? error.message : 'Unknown error',
        'network'
      );
    }
  }
}

export const flaskService = new FlaskService(); 
