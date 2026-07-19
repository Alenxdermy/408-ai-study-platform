import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class StudyRecordModel extends Model {
  declare id: string;
  declare userId: string;
  declare questionId: string;
  declare action: 'answer' | 'review' | 'plan' | 'exam' | 'checkin';
  declare isCorrect: boolean | null;
  declare durationSeconds: number;
  declare score: number;
  declare metadata: Record<string, any>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

StudyRecordModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'questions',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.ENUM('answer', 'review', 'plan', 'exam', 'checkin'),
      allowNull: false
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    durationSeconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    }
  },
  {
    sequelize,
    modelName: 'StudyRecord',
    tableName: 'study_records',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['question_id'] }
    ]
  }
);
