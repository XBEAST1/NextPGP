import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPGPKeys extends Document {
  publicKey?: string;
  privateKey?: string;
  privateKeyHash?: string;
  publicKeyHash?: string;
  vaultId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const PGPKeySchema = new Schema<IPGPKeys>(
  {
    privateKey: { type: String },
    privateKeyHash: {
      type: String,
      unique: true,
      sparse: true,
    },
    publicKey: { type: String },
    publicKeyHash: {
      type: String,
      unique: true,
      sparse: true,
    },
    vaultId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Vault",
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: false },
  }
);

const PGPKeys: Model<IPGPKeys> =
  mongoose.models.PGPKeys || mongoose.model("PGPKeys", PGPKeySchema);

export default PGPKeys;