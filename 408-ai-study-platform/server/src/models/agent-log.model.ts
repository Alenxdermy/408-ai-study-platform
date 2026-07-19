import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class AgentLogModel extends Model {
  declare id: string;
  declare userId: string | null;
  declare agent: string;
  declare input: any;
  declare output: any;
  declare status: 'success' | 'failed';
  declare latencyMs: number;
  declare errorMessage: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

AgentLogModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    agent: {
      type: DataTypes.STRING,
      allowNull: false
    },
    input: {
      type: DataTypes.JSON,
      allowNull: false
    },
    output: {
      type: DataTypes.JSON,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('success', 'failed'),
      allowNull: false
    },
    latencyMs: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ''
    }
  },
  {
    sequelize,
    modelName: 'AgentLog',
    tableName: 'agent_logs',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['agent'] },
      { fields: ['status'] }
    ]
  }
);
