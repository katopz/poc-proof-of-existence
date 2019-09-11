const StellarSdk = require('stellar-sdk')
const fetch = require('isomorphic-fetch')

// Alice account
sourceSecretKey = 'SDCELTHJLRMUE4MK6KU5LAFDSDL7FXSLPBSVRVPDM7EBHYSMXEZ2RC5C'
const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey)
const sourcePublicKey = sourceKeypair.publicKey()

// Bob account
const receiverSecretKey = 'SAA77OTO5DJFJCPPQQOBXCITUEKIUJPC4WV4FAET7C5NNAI6APEZ3YGL'
const receiverKeypair = StellarSdk.Keypair.fromSecret(receiverSecretKey)
const receiverPublicKey = receiverKeypair.publicKey()

// Horizon : testnet
const server = new StellarSdk.Server('https://horizon-testnet.stellar.org')

// Add hash as memo
const commitToLedger = async (amount, hash) => {
  const account = await server.loadAccount(sourcePublicKey)
  const fee = await server.fetchBaseFee()

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee,
    networkPassphrase: StellarSdk.Networks.TESTNET,
    memo: hash
  })
    // Add a payment operation to the transaction
    .addOperation(
      StellarSdk.Operation.payment({
        destination: receiverPublicKey,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString()
      })
    )
    .setTimeout(0)
    .build()

  // Sign this transaction with the secret key
  transaction.sign(sourceKeypair)

  // Let's see the XDR (encoded in base64) of the transaction we just built
  // console.log(transaction.toEnvelope().toXDR('base64'));

  try {
    const transactionResult = await server.submitTransaction(transaction)
    // console.log(JSON.stringify(transactionResult, null, 2))
    return transactionResult.hash
  } catch (error) {
    console.log('An error has occurred:')
    return error
  }
}

// Proof
const proofHash = async hash => fetch(`https://horizon-testnet.stellar.org/transactions/${hash}`)

// Pay
const pay = async attachment => {
  // Calculating Attachment hash
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256')

  hash.update(JSON.stringify(attachment))
  const hex = hash.digest('hex')
  const memoHashHex = StellarSdk.Memo.hash(hex)

  // TODO : Write this to database
  const base64Memo = memoHashHex._value.toString('base64')

  // Stamp memo hash on ledger
  const tx_id = await commitToLedger(attachment.amount, memoHashHex)

  // TODO : Write to `tx_id` field in Database for proof later
  console.log('Transaction ID from Stellar =', tx_id)

  // To prove existence
  const res = await proofHash(tx_id)
  const json = await res.json()

  // This should show same hash
  console.log('Memo from Stellar  =', json.memo)
  console.log('Memo from Database =', base64Memo)

  // TODO : Get into operation and get amount for comparison
}

pay({
  from: 'Alice',
  to: 'Bob',
  amount: 100
}).catch(error => {
  console.error(error)
})
