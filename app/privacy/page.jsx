"use client";

import { motion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const PrivacyPage = () => {
  return (
    <div className="bg-black text-white flex flex-col items-center">
      <div className="max-w-3xl w-full p-6">
        <motion.h1
          {...fadeInUp}
          className="text-3xl font-bold mb-6 text-center"
        >
          Privacy Policy
        </motion.h1>

        <motion.div {...fadeInUp} className="space-y-4">
          <p>Effective Date: June 20, 2025</p>

          <p>
            NextPGP is committed to user privacy. We do not collect, store, or
            share your personal data. All cryptographic operations (key
            generation, encryption, decryption) are done locally in your
            browser.
          </p>

          <p>
            We use access to Gmail only to send OTP emails for deleting
            encrypted vaults. No other Gmail data is accessed or stored.
          </p>

          <p>
            Your data never leaves your device unless you explicitly export or
            send it.
          </p>

          <p>
            If you have any questions, please contact us at{" "}
            <a
              href="mailto:xbeast331@proton.me"
              className="text-blue-400 underline"
            >
              xbeast331@proton.me
            </a>
            .
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default PrivacyPage;