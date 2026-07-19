import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../shared/database.js';

export class ReviewTaskModel extends Model {
  declare id: string;
  declare userId: string;
  declare questionId: string | null;
  declare knowledgePoint: string;
  declare dueAt: Date;
  declare intervalDays: number;
  declare easeFactor: number;
  declare status: 'pending' | 'done' | 'skipped';
  declare createdAt: Date;
  declare updatedAt: Date;
}

ReviewTaskModel.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    questionId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'questions', key: 'id' }
    },
    knowledgePoint: {
      type: DataTypes.STRING,
      allowNull: false
    },
    dueAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    intervalDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    easeFactor: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 2.5
    },
    status: {
      type: DataTypes.ENUM('pending', 'done', 'skipped'),
      allowNull: false,
      defaultValue: 'pending'
    }
  },
  {
    sequelize,
    modelName: 'ReviewTask',
    tableName: 'review_tasks',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['question_id'] },
      { fields: ['knowledge_point'] },
      { fields: ['due_at'] },
      { fields: ['status'] }
    ]
  }
);
