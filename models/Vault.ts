import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVault extends Document {
  name: string;
  passwordHash: string;
  encryptionSalt: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  lastActivity?: Date;
}

const VaultSchema = new Schema<IVault>(
  {
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    encryptionSalt: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    lastActivity: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

const Vault: Model<IVault> =
  mongoose.models.Vault || mongoose.model<IVault>("Vault", VaultSchema);

export default Vault;
