// GET /agents
export const getAllAgents = async (req, res) => {
  try {
    const agents = await prisma.agent.findMany();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener agentes" });
  }
};

// GET /agents/:id
export const getAgentById = async (req, res) => {
  const { id } = req.params;
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: parseInt(id) },
    });
    if (!agent) return res.status(404).json({ error: "Agente no encontrado" });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener agente" });
  }
};

// GET /agents/:id/chats
export const getAgentChats = async (req, res) => {
  const { id } = req.params;
  try {
    const chats = await prisma.chat.findMany({
      where: { agentId: parseInt(id) },
    });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener chats del agente" });
  }
};

// POST /agents
export const createAgent = async (req, res) => {
  const { name, role } = req.body;
  try {
    const agent = await prisma.agent.create({
      data: { name, role },
    });
    res.status(201).json(agent);
  } catch (err) {
    res.status(500).json({ error: "Error al crear agente" });
  }
};
