import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class UserModel extends Model {
  declare id: string;
  declare openId: string | null;
  declare unionId: string | null;
  declare nickname: string;
  declare avatarUrl: string;
  declare phone: string | null;
  declare passwordHash: string | null;
  declare targetScore: number;
  declare examDate: Date | null;
  declare status: 'active' | 'disabled';
  declare stats: {
    totalQuestions: number;
    correctQuestions: number;
    studyMinutes: number;
    streakDays: number;
    lastCheckInAt: Date | null;
  };
  declare achievements: Array<{ code: string; name: string; unlockedAt: Date }>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

UserModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    openId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    unionId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    nickname: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '408考生'
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: ''
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    targetScore: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 120
    },
    examDate: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'disabled'),
      allowNull: false,
      defaultValue: 'active'
    },
    stats: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        totalQuestions: 0,
        correctQuestions: 0,
        studyMinutes: 0,
        streakDays: 0,
        lastCheckInAt: null
      }
    },
    achievements: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    indexes: [
      { fields: ['open_id'] },
      { fields: ['union_id'] },
      { fields: ['phone'] }
    ]
  }
);
