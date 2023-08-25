import {
  Box,
  Container,
  Button,
  Typography,
  TextField,
  Grid,
  Link,
  Paper,
} from "@mui/material";
import React, { useState, useEffect } from "react";
import { useTheme } from "@mui/material";
import { fetchData } from "../../shared/utils/database";
import { generateProof } from "../../shared/utils/proof";
import { getNearBalance } from "../../shared/utils/near";
import { LoadingButton } from "@mui/lab";
import { useSearchParams } from "react-router-dom";
import { SERVER } from "../../shared/Constants/constants";
import { mimc7 } from "circomlib";
import QRCode from "qrcode.react";
import { create } from "ipfs-http-client";
import { enqueueSnackbar } from "notistack";
import LockPersonIcon from "@mui/icons-material/LockPerson";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import BigNumber from "bignumber.js";
import { stringToHex, hexToString } from "../../shared/utils/stringhex";
const BigInt = require("big-integer");

const ProofCreation = ({ isSignedIn, wallet }) => {
  const [accountId, setAccountId] = useState("");
  const [pass, setPass] = useState("");
  const [web2Id, setWeb2Id] = useState("");
  const [balance, setBalance] = useState("");
  const [loading, setLoading] = useState(false);
  const [leafExisted, setLeafExisted] = useState(false);
  const [url, setUrl] = useState(null);
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState(0);

  const projectId = "2PyRVePShrDRMUhgHdpf6zW7NSw";
  const projectSecret = "69325cd9fa06b38d50d44dcfcb5e0e56";
  const auth =
    "Basic " + Buffer.from(projectId + ":" + projectSecret).toString("base64");

  const client = create({
    host: "ipfs.infura.io",
    port: 5001,
    protocol: "https",
    apiPath: "/api/v0",
    headers: {
      authorization: auth,
    },
  });

  useEffect(() => {
    wallet.getAccounts().then((data) => {
      let curAccountId = data[0].accountId;
      setAccountId(curAccountId);
      getNearBalance(curAccountId).then((nearBalance) => {
        let availableBalance = new BigNumber(nearBalance.available)
          .dividedBy(1000000000000000000000000)
          .toFixed(2);
        setBalance(availableBalance);
      });
    });
  }, []);

  useEffect(() => {
    if (accountId) {
      fetchData(
        { accountId: accountId },
        SERVER + "merkletree/checkUserLeaf/"
      ).then((data) => {
        if (data !== null) {
          setLeafExisted(true);
        }
      });
    }
  }, [accountId]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(url).then(() => {
      alert("Copied to clipboard");
    });
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const handleProvideAuthHash = async () => {
    let accountIdHash = await stringToHex(accountId);
    let web2IdHash = await stringToHex(web2Id);

    let auth_hash = mimc7
      .multiHash([
        BigInt(accountIdHash, 16).value,
        BigInt(web2IdHash, 16).value,
        BigInt(pass, 10).value,
      ])
      .toString();
    await fetchData(
      {
        auth_hash: auth_hash,
        accountId: accountId,
        accountIdHash: "0x" + accountIdHash,
      },
      SERVER + "merkletree/provideAuthHash"
    ).then((data) => {
      console.log(data);
    });
  };

  const handleGenerateProof = async () => {
    setLoading(true);
    try {
      if (leafExisted === false) {
        await handleProvideAuthHash();
        await sleep(10000);
      }
      let accountIdHash = await stringToHex(accountId);
      let web2IdHash = await stringToHex(web2Id);
      let data = await fetchData(
        { accountId: accountId },
        SERVER + "merkletree/info"
      );
      let information = await getNearBalance(accountId);
      let currentTimestamp = Math.floor(new Date().getTime() / 1000);
      console.log(data);
      const input = {
        accountId: "0x" + accountIdHash,
        information: information.available,
        condition: 0,
        web2Id: "0x" + web2IdHash,
        pass: pass,
        verifyTimestamp: currentTimestamp.toString(),
        authHash: data.auth_hash,
        root: data.root,
        operator: 3,
        min: 0,
        max: 200000000000000000000000000,
        direction: data.direction,
        siblings: data.siblings,
      };
      let proof = await generateProof(input);
      if (proof != -1) {
        const jsonText = JSON.stringify(proof, null, "\t");
        const added = await client.add(jsonText);
        setUrl("https://ipfs.io/ipfs/" + added.path);
        enqueueSnackbar("Create proof successfully!", {
          variant: "success",
          autoHideDuration: 20000,
        });
      } else {
        enqueueSnackbar("Wrong password!", {
          variant: "error",
          autoHideDuration: 5000,
        });
      }
    } catch (err) {
      enqueueSnackbar("Create proof unsuccessfully!", {
        variant: "error",
        autoHideDuration: 5000,
      });
    }

    setLoading(false);
  };

  return (
    <Box mb={5} sx={{ paddingTop: "50px", backgroundColor: "white" }}>
      {isSignedIn ? (
        <Container>
          <Box mt={2}>
            <Box sx={{ width: "100%" }}>
              <Grid
                container
                sx={{ display: "flex", justifyContent: "center" }}
              >
                <Grid
                  item
                  xs={12}
                  md={6}
                  sx={{
                    paddingBottom: { xs: "20px", lg: 0 },
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: "100px",
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      backgroundColor: "rgb(240, 240, 241)",
                      fontFamily: theme.typography.typography,
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "rgb(114, 114, 122)",
                      display: "flex",
                      alignItems: "center",
                      padding: "10px",
                      borderRadius: "20px",
                    }}
                    mb={0.5}
                  >
                    <AccountCircleIcon
                      sx={{
                        fontSize: "30px",
                        color: "rgb(114, 114, 122)",
                        marginRight: "10px",
                      }}
                    />
                    {accountId}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: theme.typography.typography,
                      fontSize: "35px",
                      fontWeight: "600",
                      color: "#004aad",
                    }}
                    mb={0.5}
                  >
                    Available Balance
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: theme.typography.typography,
                        fontSize: "100px",
                        fontWeight: "700",
                        color: "#004aad",
                      }}
                    >
                      {balance}
                    </Typography>
                    <img class="token-logo" src="near.png" />
                  </Box>
                </Grid>
                {url == null ? (
                  <Grid
                    item
                    xs={12}
                    md={6}
                    sx={{
                      backgroundColor: "white",
                      padding: "40px",
                      borderRadius: "10px",
                      border: "8px solid #004aad",
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: theme.typography.typography,
                        fontSize: "30px",
                        fontWeight: "700",
                        color: "#004aad",
                      }}
                    >
                      Proof Of Information
                    </Typography>
                    {step == 0 ? (
                      <Box>
                        <Button
                          sx={{
                            backgroundColor: "#004aad",
                            color: "white",
                            textTransform: "none",
                            height: "60px",
                            width: "400px",
                            display: "block",
                            fontWeight: "700",
                            margin: "0 auto",
                            marginTop: "220px",
                            fontFamily: theme.typography,
                            fontSize: "25px",
                            "&:hover": {
                              cursor: "pointer",
                              backgroundColor: "white",
                            },
                          }}
                          onClick={() => setStep(1)}
                        >
                          Create proof
                        </Button>
                      </Box>
                    ) : (
                      ""
                    )}
                    {step == 1 ? (
                      <Box>
                        {leafExisted ? (
                          <Box>
                            <TextField
                              sx={{
                                input: {
                                  paddingLeft: "20px",
                                  color: "black",
                                  fontWeight: 500,
                                  height: "25px",
                                },
                                "& .MuiOutlinedInput-root": {
                                  "& fieldset": {
                                    borderRadius: "10px",
                                    fontWeight: 500,
                                  },
                                  "&:hover fieldset": {
                                    borderColor: theme.colors.color3,
                                    color: "white",
                                  },
                                  "&.Mui-focused fieldset": {
                                    borderColor: "#6F7E8C",
                                  },
                                },
                                width: "100%",
                                marginTop: "25px",
                                backgroundColor: "white",
                                borderRadius: "10px",
                              }}
                              InputLabelProps={{
                                style: {
                                  color: "black",
                                  fontSize: "18px",
                                  marginBottom: "5px",
                                },
                              }}
                              value={web2Id}
                              onChange={(e) => setWeb2Id(e.target.value)}
                              label="Web2 ID"
                              variant="filled"
                            />
                            <TextField
                              sx={{
                                input: {
                                  paddingLeft: "20px",
                                  color: "black",
                                  fontWeight: 500,
                                  height: "25px",
                                },
                                "& .MuiOutlinedInput-root": {
                                  "& fieldset": { borderRadius: "10px" },
                                  "&:hover fieldset": {
                                    borderColor: theme.colors.color3,
                                    color: "#E2EDFF",
                                  },
                                  "&.Mui-focused fieldset": {
                                    borderColor: "#6F7E8C",
                                  },
                                },
                                width: "100%",
                                marginTop: "25px",
                                backgroundColor: "white",
                                borderRadius: "10px",
                              }}
                              InputLabelProps={{
                                style: {
                                  color: "black",
                                  fontSize: "18px",
                                  marginBottom: "5px",
                                },
                              }}
                              value={pass}
                              onChange={(e) => setPass(e.target.value)}
                              label="Password"
                              variant="filled"
                            />
                            <LoadingButton
                              sx={{
                                width: "100%",
                                backgroundColor: theme.colors.btn,
                                opacity: 1,
                                marginTop: "20px",
                                height: "60px",
                                color: "#fff",
                                fontFamily: theme.typography.fontFamily,
                                fontSize: "20px",
                                fontWeight: "600",
                                textTransform: "none",
                              }}
                              onClick={handleGenerateProof}
                              loading={loading}
                            >
                              Create Proof-of-information
                            </LoadingButton>
                          </Box>
                        ) : (
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: theme.typography.typography,
                                fontSize: "14px",
                                fontWeight: "600",
                                color: "red",
                              }}
                              mt={2}
                            >
                              * This is your first time creating proof. Please
                              provide web2 ID, password for proof generation!
                            </Typography>
                            <TextField
                              sx={{
                                input: {
                                  paddingLeft: "20px",
                                  color: "black",
                                  fontWeight: 500,
                                  height: "25px",
                                },
                                "& .MuiOutlinedInput-root": {
                                  "& fieldset": {
                                    borderRadius: "10px",
                                    fontWeight: 500,
                                  },
                                  "&:hover fieldset": {
                                    borderColor: theme.colors.color3,
                                    color: "white",
                                  },
                                  "&.Mui-focused fieldset": {
                                    borderColor: "#6F7E8C",
                                  },
                                },
                                width: "100%",
                                marginTop: "25px",
                                backgroundColor: "white",
                                borderRadius: "10px",
                              }}
                              InputLabelProps={{
                                style: {
                                  color: "black",
                                  fontSize: "18px",
                                  marginBottom: "5px",
                                },
                              }}
                              value={web2Id}
                              onChange={(e) => setWeb2Id(e.target.value)}
                              label="Web2 ID"
                              variant="filled"
                            />
                            <TextField
                              sx={{
                                input: {
                                  paddingLeft: "20px",
                                  color: "black",
                                  fontWeight: 500,
                                  height: "25px",
                                },
                                "& .MuiOutlinedInput-root": {
                                  "& fieldset": { borderRadius: "10px" },
                                  "&:hover fieldset": {
                                    borderColor: theme.colors.color3,
                                    color: "#E2EDFF",
                                  },
                                  "&.Mui-focused fieldset": {
                                    borderColor: "#6F7E8C",
                                  },
                                },
                                width: "100%",
                                marginTop: "25px",
                                backgroundColor: "white",
                                borderRadius: "10px",
                              }}
                              InputLabelProps={{
                                style: { color: "black", fontSize: "18px" },
                              }}
                              value={pass}
                              onChange={(e) => setPass(e.target.value)}
                              label="Password"
                              variant="filled"
                            />
                            <LoadingButton
                              sx={{
                                width: "100%",
                                backgroundColor: theme.colors.btn,
                                opacity: 1,
                                marginTop: "20px",
                                height: "40px",
                                color: "#fff",
                                fontFamily: theme.typography.fontFamily,
                                fontSize: "15px",
                                fontWeight: "600",
                                textTransform: "none",
                              }}
                              onClick={handleGenerateProof}
                              loading={loading}
                            >
                              Provide information and create Proof
                            </LoadingButton>
                          </Box>
                        )}
                      </Box>
                    ) : (
                      ""
                    )}
                  </Grid>
                ) : (
                  <Grid
                    item
                    xs={12}
                    lg={6}
                    sx={{
                      backgroundColor: "#004aad",
                      borderRadius: "10px",
                      width: "100%",
                      padding: "40px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <QRCode
                      id="qrcode"
                      value={url}
                      size={280}
                      level={"H"}
                      includeMargin={true}
                    />{" "}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        paddingTop: "20px",
                      }}
                    >
                      <Typography
                        variant="body2"
                        textAlign={"center"}
                        sx={{
                          fontFamily: theme.typography.typography,
                          fontSize: "25px",
                          fontWeight: "700",
                          color: "white",
                        }}
                      >
                        Proof IPFS url
                      </Typography>

                      <Button
                        sx={{
                          minWidth: 0,
                          borderRadius: "5px",
                          opacity: 1,
                          height: "20px",
                          color: "#fff",
                          fontFamily: theme.typography.fontFamily,
                          fontSize: "20px",
                          fontWeight: "600",
                          textTransform: "none",
                          marginLeft: "5px",
                        }}
                        onClick={copyToClipboard}
                      ></Button>
                    </Box>
                    <Link
                      href={url}
                      sx={{
                        fontFamily: theme.typography.typography,
                        width: "100%",
                        fontSize: "12px",
                        fontWeight: "400",
                        color: theme.colors.color2,
                        textDecoration: "none",
                      }}
                    >
                      <Typography
                        variant="body2"
                        textAlign={"center"}
                        multiline
                        sx={{
                          display: "-webkit-box",
                          boxOrient: "vertical",
                          lineClamp: 2,
                          wordBreak: "break-all",
                          overflow: "hidden",
                          fontFamily: theme.typography.typography,
                          fontSize: "12px",
                          fontWeight: "400",
                          color: "white",
                          textDecoration: "none",
                        }}
                      >
                        {url}
                      </Typography>
                    </Link>
                  </Grid>
                )}
              </Grid>
            </Box>
          </Box>
        </Container>
      ) : (
        <Container>
          <Paper
            sx={{
              backgroundColor: "#004aad",
              height: "200px",
              padding: "50px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transition: ".3s",
            }}
          >
            <LockPersonIcon
              sx={{ color: "white", fontSize: "40px", marginRight: "10px" }}
            />
            <Typography
              variant="body2"
              sx={{
                fontFamily: theme.typography.typography,
                fontSize: "40px",
                fontWeight: "700",
                color: "white",
              }}
            >
              Please connect wallet to join us!
            </Typography>
          </Paper>
        </Container>
      )}
      <Box
        sx={{ display: "flex", justifyContent: "flex-end", paddingTop: "10px" }}
      >
        <Typography
          variant="body2"
          sx={{
            fontFamily: theme.typography.typography,
            fontSize: "12px",
            fontWeight: "400",
            color: theme.colors.color6,
            marginRight: "20px",
            marginTop: "30px",
          }}
        >
          Copyright © 2023 POI
        </Typography>
      </Box>
    </Box>
  );
};

export default ProofCreation;
