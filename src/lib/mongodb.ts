import mongoose, { type Connection } from 'mongoose';
import { getMongoUri } from '@/lib/games';
import { getAgentModel } from '@/models/Agent';
import { getGameModel } from '@/models/Game';
import { getSimCardModel } from '@/models/SimCard';
import { getVerificationRequestModel } from '@/models/VerificationRequest';

let connection: Connection | null = null;

export async function connectDB(): Promise<Connection> {
  if (connection?.readyState === 1) return connection;

  connection = mongoose.createConnection(getMongoUri(), { bufferCommands: false });
  await connection.asPromise();

  getAgentModel(connection);
  getGameModel(connection);
  getSimCardModel(connection);
  getVerificationRequestModel(connection);

  return connection;
}

export async function getModels() {
  const conn = await connectDB();
  return {
    Agent: getAgentModel(conn),
    Game: getGameModel(conn),
    SimCard: getSimCardModel(conn),
    VerificationRequest: getVerificationRequestModel(conn),
  };
}
