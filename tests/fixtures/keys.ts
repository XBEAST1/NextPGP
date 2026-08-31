/**
 * Pre-generated deterministic OpenPGP key fixtures for the NextPGP test suite.
 * Generated using ECC (Curve25519 / Ed25519) for fast headless testing.
 */

import type { StoredPGPKey } from "@/app/decrypt/decryptWorker.types";

export const TEST_PASSWORDS = {
  SYMMETRIC: "symmetric-vault-password-789",
  CHARLIE_KEY: "charlie-pass-123",
  DAVE_KEY: "dave-pass-456",
  WRONG_PASSWORD: "incorrect-password-xyz",
} as const;

export interface TestKeyFixture {
  id: string;
  name: string;
  email: string;
  publicKey: string;
  privateKey: string;
  passphrase?: string;
  isPasswordProtected: boolean;
}

/** 1. Alice - Plain key (no passphrase) */
export const aliceKey: TestKeyFixture = {
  id: "key-alice-01",
  name: "Alice",
  email: "alice@nextpgp.local",
  publicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nxjMEapWBYBYJKwYBBAHaRw8BAQdAiV2QgdwSuqIJzodVeQw0Z2t8uQ5Vyxjb\n+4Lk9ey4ku/NG0FsaWNlIDxhbGljZUBuZXh0cGdwLmxvY2FsPsLAEwQTFgoA\nhQWCapWBYAMLCQcJkGbctqWla2JHRRQAAAAAABwAIHNhbHRAbm90YXRpb25z\nLm9wZW5wZ3Bqcy5vcmdzn4NdOol1eLLh5KqhLDDPyswJRhIllTCyvb63zz9u\nsQUVCggODAQWAAIBAhkBApsDAh4BFiEEDACnUvukHFSQilbWZty2paVrYkcA\nALtHAP47eYU6hTDlk/2AKg0OD4MXByFoDX0paPd7LxT44TdKvwD/Sygmd9RJ\n21dPA4emB0XgzCDYKhyezHJ2ZYisQgg9OwzOOARqlYFgEgorBgEEAZdVAQUB\nAQdAzduSNComBk0mpWrANmikZtBcIDl5PJUuwU73nKULuQsDAQgHwr4EGBYK\nAHAFgmqVgWAJkGbctqWla2JHRRQAAAAAABwAIHNhbHRAbm90YXRpb25zLm9w\nZW5wZ3Bqcy5vcmc2Sj2aaceWDf0SDSEq1uIC9tAAKwk9mX0M+7QYmrmPggKb\nDBYhBAwAp1L7pBxUkIpW1mbctqWla2JHAACuOQEAkHY7Ul2/4/XFrHZ4l2LS\niZJKk6e7W9bm5TEByFOSUQYA/iScPGCpOwa+Nf4H4KrhPM7Jo6fPTHZjd3ca\nzvA3KL4B\n=3kH6\n-----END PGP PUBLIC KEY BLOCK-----\n",
  privateKey: "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nxVgEapWBYBYJKwYBBAHaRw8BAQdAiV2QgdwSuqIJzodVeQw0Z2t8uQ5Vyxjb\n+4Lk9ey4ku8AAQDDx/ICM7fi7z5iyi15tzE4K/uARuMBE4y2uWz2m2080xDB\nzRtBbGljZSA8YWxpY2VAbmV4dHBncC5sb2NhbD7CwBMEExYKAIUFgmqVgWAD\nCwkHCZBm3LalpWtiR0UUAAAAAAAcACBzYWx0QG5vdGF0aW9ucy5vcGVucGdw\nanMub3Jnc5+DXTqJdXiy4eSqoSwwz8rMCUYSJZUwsr2+t88/brEFFQoIDgwE\nFgACAQIZAQKbAwIeARYhBAwAp1L7pBxUkIpW1mbctqWla2JHAAC7RwD+O3mF\nOoUw5ZP9gCoNDg+DFwchaA19KWj3ey8U+OE3Sr8A/0soJnfUSdtXTwOHpgdF\n4Mwg2CocnsxydmWIrEIIPTsMx10EapWBYBIKKwYBBAGXVQEFAQEHQM3bkjQq\nJgZNJqVqwDZopGbQXCA5eTyVLsFO95ylC7kLAwEIBwAA/2WBfJBulzVnydsu\nNFFeh2xmoTcrhBwHC4Yh+ytCKshgDbbCvgQYFgoAcAWCapWBYAmQZty2paVr\nYkdFFAAAAAAAHAAgc2FsdEBub3RhdGlvbnMub3BlbnBncGpzLm9yZzZKPZpp\nx5YN/RINISrW4gL20AArCT2ZfQz7tBiauY+CApsMFiEEDACnUvukHFSQilbW\nZty2paVrYkcAAK45AQCQdjtSXb/j9cWsdniXYtKJkkqTp7tb1ublMQHIU5JR\nBgD+JJw8YKk7Br41/gfgquE8zsmjp89MdmN3dxrO8DcovgE=\n=y7/p\n-----END PGP PRIVATE KEY BLOCK-----\n",
  isPasswordProtected: false,
};

/** 2. Bob - Plain key (no passphrase) */
export const bobKey: TestKeyFixture = {
  id: "key-bob-02",
  name: "Bob",
  email: "bob@nextpgp.local",
  publicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nxjMEapWBYBYJKwYBBAHaRw8BAQdADecmolf6xtTQVkDtsh4xRVEsIcc67ZhP\nP4VFdGgX/P3NF0JvYiA8Ym9iQG5leHRwZ3AubG9jYWw+wsATBBMWCgCFBYJq\nlYFgAwsJBwmQTd7pnmNruahFFAAAAAAAHAAgc2FsdEBub3RhdGlvbnMub3Bl\nbnBncGpzLm9yZ3Fs19M3GD5s89RlCG3appuVWNBaJ7cxow6VMFgY8B9cBRUK\nCA4MBBYAAgECGQECmwMCHgEWIQSwHVZNUU3bxXAadMBN3umeY2u5qAAAg0AB\nANXOgcNlwMw2oJU20Vqxe+lsfCbCKBjN1iytBTZqDfuMAQCuvNRTudII9nZH\nlkhJBZ44sUPmr83lSbMnjpM7uEZ3DM44BGqVgWASCisGAQQBl1UBBQEBB0Dc\ngCM3JFtG7MAXMCSwA9JxoLZnAT4n/QZp4OmnMknaSwMBCAfCvgQYFgoAcAWC\napWBYAmQTd7pnmNruahFFAAAAAAAHAAgc2FsdEBub3RhdGlvbnMub3BlbnBn\ncGpzLm9yZzcEv1/IMdek6e7hFEIC7gcqwvv1DkLXeFRc4kG04TMTApsMFiEE\nsB1WTVFN28VwGnTATd7pnmNruagAAIIZAQCel75rYMO4cYi2kEKgGOWn5b4J\ntmRRfA4pyyje5gwkiwD/Z69ajxf8O6LcoXyrCJfd0XeL2pxuc7iDOAXyfQHz\nQg4=\n=/ZK5\n-----END PGP PUBLIC KEY BLOCK-----\n",
  privateKey: "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nxVgEapWBYBYJKwYBBAHaRw8BAQdADecmolf6xtTQVkDtsh4xRVEsIcc67ZhP\nP4VFdGgX/P0AAP9lH/Mxy9F0ZTvY6wdsMWP+Te4lUYETcr9wkBu1XnMOGA9c\nzRdCb2IgPGJvYkBuZXh0cGdwLmxvY2FsPsLAEwQTFgoAhQWCapWBYAMLCQcJ\nkE3e6Z5ja7moRRQAAAAAABwAIHNhbHRAbm90YXRpb25zLm9wZW5wZ3Bqcy5v\ncmdxbNfTNxg+bPPUZQht2qablVjQWie3MaMOlTBYGPAfXAUVCggODAQWAAIB\nAhkBApsDAh4BFiEEsB1WTVFN28VwGnTATd7pnmNruagAAINAAQDVzoHDZcDM\nNqCVNtFasXvpbHwmwigYzdYsrQU2ag37jAEArrzUU7nSCPZ2R5ZISQWeOLFD\n5q/N5UmzJ46TO7hGdwzHXQRqlYFgEgorBgEEAZdVAQUBAQdA3IAjNyRbRuzA\nFzAksAPScaC2ZwE+J/0GaeDppzJJ2ksDAQgHAAD/VqGAMuLZVqGBL9PqW9Sv\nFGrVSGL5nxn8FbhH8SrWgugSvsK+BBgWCgBwBYJqlYFgCZBN3umeY2u5qEUU\nAAAAAAAcACBzYWx0QG5vdGF0aW9ucy5vcGVucGdwanMub3JnNwS/X8gx16Tp\n7uEUQgLuByrC+/UOQtd4VFziQbThMxMCmwwWIQSwHVZNUU3bxXAadMBN3ume\nY2u5qAAAghkBAJ6Xvmtgw7hxiLaQQqAY5aflvgm2ZFF8DinLKN7mDCSLAP9n\nr1qPF/w7otyhfKsIl93Rd4vanG5zuIM4BfJ9AfNCDg==\n=BxEV\n-----END PGP PRIVATE KEY BLOCK-----\n",
  isPasswordProtected: false,
};

/** 3. Charlie - Password-protected key (passphrase: "charlie-pass-123") */
export const charlieProtectedKey: TestKeyFixture = {
  id: "key-charlie-03",
  name: "Charlie",
  email: "charlie@nextpgp.local",
  publicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nxjMEapWBYBYJKwYBBAHaRw8BAQdAoJE9SNS8kBsjkSxn5nSXntcBWdKigeji\nfrNcRDfmNLDNH0NoYXJsaWUgPGNoYXJsaWVAbmV4dHBncC5sb2NhbD7CwBME\nExYKAIUFgmqVgWADCwkHCZDuCtY8DWuUNEUUAAAAAAAcACBzYWx0QG5vdGF0\naW9ucy5vcGVucGdwanMub3JnGwdwbSKWEBPFGbiCVU+Hdq9dr73eVgtW8jqJ\npZSAJWEFFQoIDgwEFgACAQIZAQKbAwIeARYhBEGDptKqqae/T3I12e4K1jwN\na5Q0AAApIQD/Zz/CzqO2UHJU6O6RiVc6q7zR6uRrmohr1dNQh9Wv948A/1tj\n4g3fVt9jpJlmfsu0S/kB4e7LJugTIvtQt+CGieMMzjgEapWBYBIKKwYBBAGX\nVQEFAQEHQOYyc+2p98NTNUK5YzBTlhR6QkoxLIEBPT3pj0EGQRBCAwEIB8K+\nBBgWCgBwBYJqlYFgCZDuCtY8DWuUNEUUAAAAAAAcACBzYWx0QG5vdGF0aW9u\ncy5vcGVucGdwanMub3Jnkko5wpuDKE0Mznqt/cHwlKThoaFR8FYZRqeVUZ71\nXu4CmwwWIQRBg6bSqqmnv09yNdnuCtY8DWuUNAAA6WUBAMwjW6OkQ0zWFWnq\nNYnTd83jEoMaA/X5k35abVCVVvMxAP0fP8s/xlkFovqP8e2H5BYP2bCuaApF\n+ZzuhZ5VoXhEAw==\n=cE8P\n-----END PGP PUBLIC KEY BLOCK-----\n",
  privateKey: "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nxYYEapWBYBYJKwYBBAHaRw8BAQdAoJE9SNS8kBsjkSxn5nSXntcBWdKigeji\nfrNcRDfmNLD+CQMIb47nFcLe+Zzg37Gzdvicj7GyBYQA+a/k7jsOLUKn6NV2\n+J6cDrjaejgczOW9mpfOms5JdNtANCs3i8oWbCiHWb76CGEb7zPb1dJZhqq9\n2c0fQ2hhcmxpZSA8Y2hhcmxpZUBuZXh0cGdwLmxvY2FsPsLAEwQTFgoAhQWC\napWBYAMLCQcJkO4K1jwNa5Q0RRQAAAAAABwAIHNhbHRAbm90YXRpb25zLm9w\nZW5wZ3Bqcy5vcmcbB3BtIpYQE8UZuIJVT4d2r12vvd5WC1byOomllIAlYQUV\nCggODAQWAAIBAhkBApsDAh4BFiEEQYOm0qqpp79PcjXZ7grWPA1rlDQAACkh\nAP9nP8LOo7ZQclTo7pGJVzqrvNHq5GuaiGvV01CH1a/3jwD/W2PiDd9W32Ok\nmWZ+y7RL+QHh7ssm6BMi+1C34IaJ4wzHiwRqlYFgEgorBgEEAZdVAQUBAQdA\n5jJz7an3w1M1QrljMFOWFHpCSjEsgQE9PemPQQZBEEIDAQgH/gkDCHtXmMBu\nmiDB4PRWgI7eCgoyINOOlmVjPvXHKk0i9g6TocIMjYA7FFN/Ny9X/g3b0Y+L\nUyhaC4lIJIQyGVUTmaFy0pHRAmvMRLhOiv1TAVbCvgQYFgoAcAWCapWBYAmQ\n7grWPA1rlDRFFAAAAAAAHAAgc2FsdEBub3RhdGlvbnMub3BlbnBncGpzLm9y\nZ5JKOcKbgyhNDM56rf3B8JSk4aGhUfBWGUanlVGe9V7uApsMFiEEQYOm0qqp\np79PcjXZ7grWPA1rlDQAAOllAQDMI1ujpENM1hVp6jWJ03fN4xKDGgP1+ZN+\nWm1QlVbzMQD9Hz/LP8ZZBaL6j/Hth+QWD9mwrmgKRfmc7oWeVaF4RAM=\n=uhIb\n-----END PGP PRIVATE KEY BLOCK-----\n",
  passphrase: TEST_PASSWORDS.CHARLIE_KEY,
  isPasswordProtected: true,
};

/** 4. Dave - Password-protected key (passphrase: "dave-pass-456") */
export const daveProtectedKey: TestKeyFixture = {
  id: "key-dave-04",
  name: "Dave",
  email: "dave@nextpgp.local",
  publicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nxjMEapWBYBYJKwYBBAHaRw8BAQdArTDne7p/95oCXqcOdVWjr85IVgwSpN41\nq9tMNSAOyu7NGURhdmUgPGRhdmVAbmV4dHBncC5sb2NhbD7CwBMEExYKAIUF\ngmqVgWADCwkHCZBJOSk73/wi40UUAAAAAAAcACBzYWx0QG5vdGF0aW9ucy5v\ncGVucGdwanMub3JnTNL5/It5aFfchTky1aQ0aIMIoYnMrbByxVvklNzCVbIF\nFQoIDgwEFgACAQIZAQKbAwIeARYhBKmLzdX2OxAEsx/oFEk5KTvf/CLjAABz\nCAD/ejLF6TO3bK0lgM7MHm9fdxrUfNgHUhX6ScjpTHL3J+YA/1mzUF/GFsOG\nKsWPSTDsvwRChvBbIHWQdp2NHuuA9ycJzjgEapWBYBIKKwYBBAGXVQEFAQEH\nQEexzQLBiR+OHC8m/3rOmmklHE4Rbk/jvnAnyu3xhfA3AwEIB8K+BBgWCgBw\nBYJqlYFgCZBJOSk73/wi40UUAAAAAAAcACBzYWx0QG5vdGF0aW9ucy5vcGVu\ncGdwanMub3JnlXde2TDH/mcCGMvL4jJMLAnVicyI3Ksbjuf7+IH9BAoCmwwW\nIQSpi83V9jsQBLMf6BRJOSk73/wi4wAAQu4A/33TNGmn7tn/ZH80b9ppjAFH\nJp4Dzsz7n6EsgBdhjraHAP9XGPVal2HNsOF6R3R+HCNb8NmO1aMpmC1U1fsk\nY6wfCQ==\n=J4oP\n-----END PGP PUBLIC KEY BLOCK-----\n",
  privateKey: "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nxYYEapWBYBYJKwYBBAHaRw8BAQdArTDne7p/95oCXqcOdVWjr85IVgwSpN41\nq9tMNSAOyu7+CQMIjZ9ClCQ68hbgu6CA9mN8r4wdpC5SKSwDKo4PyVXLBCat\nLvxhFp9ECohh+q64Tz2sYHpz5DCIbqC3PiC+dKAYaoDGRiqB2zyLKS0cQG8N\nE80ZRGF2ZSA8ZGF2ZUBuZXh0cGdwLmxvY2FsPsLAEwQTFgoAhQWCapWBYAML\nCQcJkEk5KTvf/CLjRRQAAAAAABwAIHNhbHRAbm90YXRpb25zLm9wZW5wZ3Bq\ncy5vcmdM0vn8i3loV9yFOTLVpDRogwihicytsHLFW+SU3MJVsgUVCggODAQW\nAAIBAhkBApsDAh4BFiEEqYvN1fY7EASzH+gUSTkpO9/8IuMAAHMIAP96MsXp\nM7dsrSWAzsweb193GtR82AdSFfpJyOlMcvcn5gD/WbNQX8YWw4YqxY9JMOy/\nBEKG8FsgdZB2nY0e64D3JwnHiwRqlYFgEgorBgEEAZdVAQUBAQdAR7HNAsGJ\nH44cLyb/es6aaSUcThFuT+O+cCfK7fGF8DcDAQgH/gkDCEP/GR1lM71r4JEq\n80D5fhWvJa9xxfROu2K4Lih2cup3bu4a1yoaSyfDSiBR3hu/IAd6D7+DpRrg\n8uocdb1AezRKBoiPhs50CYTmihG00J7CvgQYFgoAcAWCapWBYAmQSTkpO9/8\nIuNFFAAAAAAAHAAgc2FsdEBub3RhdGlvbnMub3BlbnBncGpzLm9yZ5V3Xtkw\nx/5nAhjLy+IyTCwJ1YnMiNyrG47n+/iB/QQKApsMFiEEqYvN1fY7EASzH+gU\nSTkpO9/8IuMAAELuAP990zRpp+7Z/2R/NG/aaYwBRyaeA87M+5+hLIAXYY62\nhwD/Vxj1WpdhzbDhekd0fhwjW/DZjtWjKZgtVNX7JGOsHwk=\n=L94C\n-----END PGP PRIVATE KEY BLOCK-----\n",
  passphrase: TEST_PASSWORDS.DAVE_KEY,
  isPasswordProtected: true,
};

export const ALL_TEST_KEYS: TestKeyFixture[] = [
  aliceKey,
  bobKey,
  charlieProtectedKey,
  daveProtectedKey,
];

/**
 * Converts TestKeyFixture list into StoredPGPKey objects for decrypt worker input.
 * By default, leaves passphrase unset unless includePassphrase is true.
 */
export function toStoredPGPKeys(
  keys: TestKeyFixture[],
  options: { includePassphrase?: boolean } = {}
): StoredPGPKey[] {
  return keys.map((k) => ({
    id: k.id,
    publicKey: k.publicKey,
    privateKey: k.privateKey,
    passphrase: options.includePassphrase ? k.passphrase : undefined,
    userIDs: [`${k.name} <${k.email}>`],
  }));
}
